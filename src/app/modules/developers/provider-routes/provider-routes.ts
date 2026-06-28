import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PaymentProvider, PaymentProviderService, PaymentRouteSetting } from '../../../core/services/payment-provider.service';
import { FpSelectComponent, FpSelectOption, FpSelectValue } from '../../../shared/fp-select/fp-select';

@Component({
    selector: 'app-provider-routes',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule, FpSelectComponent],
    templateUrl: './provider-routes.html',
    styleUrls: ['./provider-routes.scss']
})
export class ProviderRoutesComponent implements OnInit {
    private route = inject(ActivatedRoute);
    private paymentProviderService = inject(PaymentProviderService);

    provider = signal<PaymentProvider | null>(null);
    routes = signal<PaymentRouteSetting[]>([]);
    isLoading = signal(true);
    errorMessage = signal<string | null>(null);
    countryFilter = signal('ALL');
    operatorFilter = signal('ALL');
    savingRouteId = signal<number | null>(null);
    actionError = signal<string | null>(null);
    priorityDrafts: Record<number, number> = {};

    private readonly countryNames: Record<string, string> = {
        BJ: 'Bénin',
        BF: 'Burkina Faso',
        CI: "Côte d’Ivoire",
        CM: 'Cameroun',
        INT: 'International',
        ML: 'Mali',
        NE: 'Niger',
        SN: 'Sénégal',
        TG: 'Togo'
    };

    countries = computed(() => [...new Set(this.routes().map(route => route.country))].sort());
    operators = computed(() => [...new Set(this.routes().map(route => route.operator))].sort());
    countryOptions = computed<FpSelectOption[]>(() => [
        { value: 'ALL', label: 'Tous' },
        ...this.countries().map(country => ({ value: country, label: this.countryName(country) }))
    ]);
    operatorOptions = computed<FpSelectOption[]>(() => [
        { value: 'ALL', label: 'Tous' },
        ...this.operators().map(operator => ({ value: operator, label: operator }))
    ]);
    filteredRoutes = computed(() => this.routes().filter(route =>
        (this.countryFilter() === 'ALL' || route.country === this.countryFilter()) &&
        (this.operatorFilter() === 'ALL' || route.operator === this.operatorFilter())
    ));

    ngOnInit(): void {
        const providerId = Number(this.route.snapshot.paramMap.get('providerId'));
        if (!Number.isFinite(providerId)) {
            this.errorMessage.set('Agrégateur invalide.');
            this.isLoading.set(false);
            return;
        }

        forkJoin({
            providers: this.paymentProviderService.getPaymentProviders(false),
            routes: this.paymentProviderService.getPaymentRoutes(false)
        }).subscribe({
            next: ({ providers, routes }) => {
                const provider = providers.find(item => item.id === providerId) || null;
                if (!provider) {
                    this.errorMessage.set('Agrégateur introuvable.');
                }
                this.provider.set(provider);
                const providerRoutes = (routes || []).filter(route => route.providerId === providerId && route.platformEnabled);
                this.routes.set(providerRoutes);
                this.priorityDrafts = Object.fromEntries(providerRoutes.map(route => [route.routeId, route.effectivePriority]));
                this.isLoading.set(false);
            },
            error: () => {
                this.errorMessage.set('Impossible de charger les routes de cet agrégateur.');
                this.isLoading.set(false);
            }
        });
    }

    updateCountry(value: FpSelectValue): void {
        this.countryFilter.set(String(value));
    }

    updateOperator(value: FpSelectValue): void {
        this.operatorFilter.set(String(value));
    }

    countryName(countryCode: string): string {
        return this.countryNames[countryCode] || countryCode;
    }

    feeConfig(route: PaymentRouteSetting): string {
        if (route.feeType === 'FIXED') {
            return `${this.formatNumber(route.fixedFee || route.cost)} XOF fixe`;
        }
        return `${this.formatNumber(route.feeRate || route.cost)}%`;
    }

    amountRange(route: PaymentRouteSetting): string {
        const min = route.minAmount || 0;
        const max = route.maxAmount;
        if (min <= 0 && (max === undefined || max === null)) return 'Aucune limite';
        if (max !== undefined && max !== null) return `${this.formatNumber(min)} – ${this.formatNumber(max)} XOF`;
        return `Min. ${this.formatNumber(min)} XOF`;
    }

    savePriority(route: PaymentRouteSetting): void {
        const priority = Number(this.priorityDrafts[route.routeId]);
        if (!Number.isInteger(priority) || priority < 1) {
            this.actionError.set('La priorité doit être un nombre entier supérieur à zéro.');
            return;
        }
        this.savingRouteId.set(route.routeId);
        this.actionError.set(null);
        this.paymentProviderService.setPaymentRoutePriority(route.routeId, priority).subscribe({
            next: updated => this.finishRouteUpdate(updated),
            error: () => this.failRouteUpdate('Impossible de modifier la priorité de cette route.')
        });
    }

    toggleRoute(route: PaymentRouteSetting): void {
        this.savingRouteId.set(route.routeId);
        this.actionError.set(null);
        this.paymentProviderService.setPaymentRouteEnabled(route.routeId, !route.effectiveEnabled, false).subscribe({
            next: updated => this.finishRouteUpdate(updated),
            error: () => this.failRouteUpdate('Impossible de modifier l’état de cette route.')
        });
    }

    private finishRouteUpdate(updated: PaymentRouteSetting): void {
        this.routes.update(routes => routes.map(route => route.routeId === updated.routeId ? updated : route));
        this.priorityDrafts[updated.routeId] = updated.effectivePriority;
        this.savingRouteId.set(null);
    }

    private failRouteUpdate(message: string): void {
        this.actionError.set(message);
        this.savingRouteId.set(null);
    }

    private formatNumber(value: number): string {
        return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(value || 0);
    }
}
