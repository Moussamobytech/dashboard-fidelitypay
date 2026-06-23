import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FallbackSettings, PaymentProviderService, PaymentRouteSetting, RoutingPreview } from '../../core/services/payment-provider.service';
import { AuthService } from '../../core/services/auth.service';
import { FpSelectComponent, FpSelectOption } from '../../shared/fp-select/fp-select';

type ProviderPerformance = {
    provider: string;
    routes: number;
    enabled: number;
    avgCost: number;
    avgLatency: number;
    avgSuccessRate: number;
};

@Component({
    selector: 'app-routing-config',
    standalone: true,
    imports: [CommonModule, FormsModule, FpSelectComponent],
    templateUrl: './routing.html',
    styleUrls: ['./routing.scss']
})
export class RoutingConfigComponent implements OnInit {
    private paymentProviderService = inject(PaymentProviderService);
    private authService = inject(AuthService);

    routes = signal<PaymentRouteSetting[]>([]);
    isLoading = signal(true);
    fallbackSettings = signal<FallbackSettings | null>(null);
    fallbackSaveState = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');
    previewCountry = signal<string | null>(null);
    previewOperator = signal<string | null>(null);
    routingPreview = signal<RoutingPreview | null>(null);
    previewLoading = signal(false);
    previewError = signal('');
    Math = Math;

    currentPage = signal(1);
    pageSize = signal(10);

    isAdmin = computed(() => this.authService.userRole() === 'ADMIN');

    visibleRoutes = computed(() => this.routes().filter(route => route.effectiveEnabled));

    sortedRoutes = computed(() =>
        [...this.visibleRoutes()].sort((a, b) =>
            a.country.localeCompare(b.country) ||
            a.operator.localeCompare(b.operator) ||
            a.effectivePriority - b.effectivePriority
        )
    );

    paginatedRoutes = computed(() => {
        const start = (this.currentPage() - 1) * this.pageSize();
        return this.sortedRoutes().slice(start, start + this.pageSize());
    });

    totalPages = computed(() => Math.ceil(this.sortedRoutes().length / this.pageSize()) || 1);

    activeRoutes = computed(() => this.visibleRoutes().length);
    degradedRoutes = computed(() => this.visibleRoutes().filter(route => this.routeStatus(route) === 'Dégradée').length);

    providerPerformance = computed<ProviderPerformance[]>(() => {
        const grouped = this.visibleRoutes().reduce<Record<string, PaymentRouteSetting[]>>((acc, route) => {
            const key = route.providerCode || 'UNKNOWN';
            acc[key] = [...(acc[key] || []), route];
            return acc;
        }, {});

        return Object.entries(grouped).map(([provider, routes]) => ({
            provider,
            routes: routes.length,
            enabled: routes.filter(route => route.effectiveEnabled).length,
            avgCost: this.average(routes.map(route => route.cost)),
            avgLatency: this.average(routes.map(route => route.avgLatency)),
            avgSuccessRate: this.average(routes.map(route => 100 - ((route.failureRate || 0) * 100)))
        })).sort((a, b) => b.avgSuccessRate - a.avgSuccessRate);
    });

    countryOptions = computed<FpSelectOption[]>(() => [...new Set(this.visibleRoutes().map(route => route.country))]
        .sort().map(value => ({ value, label: value })));
    operatorOptions = computed<FpSelectOption[]>(() => [...new Set(this.visibleRoutes()
        .filter(route => !this.previewCountry() || route.country === this.previewCountry())
        .map(route => route.operator))].sort().map(value => ({ value, label: value })));

    ngOnInit(): void {
        this.loadRoutes();
        if (this.isAdmin()) this.loadFallbackSettings();
    }

    loadFallbackSettings(): void {
        this.paymentProviderService.getFallbackSettings().subscribe({
            next: settings => this.fallbackSettings.set(settings),
            error: () => this.fallbackSaveState.set('error')
        });
    }

    updateFallbackSetting<K extends keyof FallbackSettings>(key: K, value: FallbackSettings[K]): void {
        const current = this.fallbackSettings();
        if (!current) return;
        this.fallbackSettings.set({ ...current, [key]: value });
    }

    saveFallbackSettings(): void {
        const settings = this.fallbackSettings();
        if (!settings) return;
        this.fallbackSaveState.set('saving');
        this.paymentProviderService.updateFallbackSettings(settings).subscribe({
            next: saved => {
                this.fallbackSettings.set(saved);
                this.fallbackSaveState.set('saved');
            },
            error: () => this.fallbackSaveState.set('error')
        });
    }

    runRoutingPreview(): void {
        const country = this.previewCountry();
        const operator = this.previewOperator();
        if (!country || !operator) return;
        this.previewLoading.set(true);
        this.previewError.set('');
        this.paymentProviderService.previewRouting(country, operator).subscribe({
            next: result => { this.routingPreview.set(result); this.previewLoading.set(false); },
            error: error => {
                this.routingPreview.set(null);
                this.previewError.set(this.routingPreviewErrorMessage(error));
                this.previewLoading.set(false);
            }
        });
    }

    private routingPreviewErrorMessage(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            if (error.status === 401) {
                return 'Session non autorisée pour évaluer le routage. Reconnecte-toi puis réessaie.';
            }
            if (error.status === 403) {
                return 'Ton compte n’a pas les droits pour évaluer le routage.';
            }
            if (error.status === 404) {
                return 'Aucune route Live éligible pour cette combinaison.';
            }
            const backendMessage = error.error?.message || error.error?.error;
            if (backendMessage) {
                return backendMessage;
            }
        }
        return 'Impossible d’évaluer le routage.';
    }

    loadRoutes(): void {
        this.isLoading.set(true);
        this.paymentProviderService.getPaymentRoutes(this.isAdmin()).subscribe({
            next: routes => {
                this.routes.set(routes || []);
                this.isLoading.set(false);
            },
            error: () => {
                this.routes.set([]);
                this.isLoading.set(false);
            }
        });
    }

    setPage(page: number): void {
        if (page >= 1 && page <= this.totalPages()) {
            this.currentPage.set(page);
        }
    }

    nextPage(): void {
        this.setPage(this.currentPage() + 1);
    }

    prevPage(): void {
        this.setPage(this.currentPage() - 1);
    }

    fallbackFor(route: PaymentRouteSetting): string {
        const candidate = this.routes()
            .filter(other =>
                other.routeId !== route.routeId &&
                other.country === route.country &&
                other.operator === route.operator &&
                other.effectiveEnabled
            )
            .sort((a, b) => a.effectivePriority - b.effectivePriority)[0];
        return candidate ? `${candidate.providerCode} #${candidate.effectivePriority}` : 'Aucun';
    }

    routeStatus(route: PaymentRouteSetting): 'Active' | 'Dégradée' {
        if ((route.failureRate || 0) > 0.1 || (route.avgLatency || 0) > 1500) return 'Dégradée';
        return 'Active';
    }

    successRate(route: PaymentRouteSetting): string {
        return `${Math.max(0, 100 - ((route.failureRate || 0) * 100)).toFixed(1)}%`;
    }

    formatLatency(value: number): string {
        return value > 0 ? `${(value / 1000).toFixed(2)}s` : 'N/A';
    }

    private average(values: number[]): number {
        const valid = values.filter(value => value !== undefined && value !== null && Number.isFinite(value));
        if (!valid.length) return 0;
        return valid.reduce((sum, value) => sum + value, 0) / valid.length;
    }
}
