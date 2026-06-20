import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentProviderService, PaymentRouteSetting } from '../../core/services/payment-provider.service';
import { AuthService } from '../../core/services/auth.service';

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
    imports: [CommonModule],
    templateUrl: './routing.html',
    styleUrls: ['./routing.scss']
})
export class RoutingConfigComponent implements OnInit {
    private paymentProviderService = inject(PaymentProviderService);
    private authService = inject(AuthService);

    routes = signal<PaymentRouteSetting[]>([]);
    isLoading = signal(true);
    Math = Math;

    currentPage = signal(1);
    pageSize = signal(10);

    isAdmin = this.authService.isAdmin;

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

    ngOnInit(): void {
        this.loadRoutes();
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
