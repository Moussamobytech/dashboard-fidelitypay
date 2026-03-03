import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoringService } from '../../../core/services/monitoring.service';
import { PaymentService } from '../../../core/services/payment.service';
import { Route, ErrorType } from '../../../core/models/route.model';
import { Payment } from '../../../core/models/payment.model';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';

@Component({
    selector: 'app-developer-monitoring',
    standalone: true,
    imports: [CommonModule, BaseChartDirective],
    templateUrl: './developer-monitoring.html',
    styleUrls: ['./developer-monitoring.scss']
})
export class DeveloperMonitoringComponent implements OnInit {
    private monitoringService = inject(MonitoringService);
    private paymentService = inject(PaymentService);

    // Data Signals
    routes = signal<Route[]>([]);

    // Filters Signals
    selectedPeriod = signal<string>('24h');
    selectedProvider = signal<string>('');
    selectedCountry = signal<string>('');
    selectedStatusFilter = signal<'ACTIVE' | 'DEGRADED' | 'DOWN' | null>(null);

    // Failures Chart Signals
    failurePeriod = signal<string>('24h');

    // Canonical status helper and Computed Counts
    getCanonicalStatus(route: Route): 'ACTIVE' | 'DEGRADED' | 'DOWN' {
        const backendStatus = (route as any).status || (route as any).getStatus?.();
        if (backendStatus) {
            const s = String(backendStatus).toUpperCase();
            if (s === 'DOWN') return 'DOWN';
            if (s === 'DEGRADE' || s === 'DEGRADED') return 'DEGRADED';
            if (s === 'STABLE' || s === 'ACTIVE') return 'ACTIVE';
        }

        if (!route.availability) return 'DOWN';

        const isLatencyHigh = (route.avgLatency || 0) > 1000;
        const isFailureHigh = (route.failureRate || 0) > 0.1;

        if (isLatencyHigh || isFailureHigh) return 'DEGRADED';

        return 'ACTIVE';
    }

    activeRoutesCount = computed(() => this.routes().filter(r => this.getCanonicalStatus(r) === 'ACTIVE').length);
    degradedRoutesCount = computed(() => this.routes().filter(r => this.getCanonicalStatus(r) === 'DEGRADED').length);
    downRoutesCount = computed(() => this.routes().filter(r => this.getCanonicalStatus(r) === 'DOWN').length);

    // Derived Lists for Dropdowns
    providers = computed(() => [...new Set(this.routes().map(r => r.provider || 'UNKNOWN'))].sort());
    countries = signal<string[]>([]);

    // Filtered Routes
    filteredRoutes = computed(() => {
        let list = this.routes();

        // 1. Status Filter (from Cards)
        if (this.selectedStatusFilter()) {
            list = list.filter(r => this.getCanonicalStatus(r) === this.selectedStatusFilter());
        }

        // 2. Provider Filter
        if (this.selectedProvider()) {
            list = list.filter(r => r.provider === this.selectedProvider());
        }

        // 3. Country Filter
        if (this.selectedCountry()) {
            const filterPretty = this.getCountry(this.selectedCountry());
            list = list.filter(r => this.getCountry((r as any).countryName || r.country) === filterPretty);
        }


        // 4. Period Filter
        if (this.selectedPeriod()) {
            const now = new Date().getTime();
            const p = this.selectedPeriod();
            let startTime = 0;

            if (p === '24h') startTime = now - 24 * 3600 * 1000;
            else if (p === 'week') startTime = now - 7 * 24 * 3600 * 1000;
            else if (p === 'month') startTime = now - 30 * 24 * 3600 * 1000;
            else if (p === 'year') startTime = now - 365 * 24 * 3600 * 1000;

            if (startTime > 0) {
                list = list.filter(r => {
                    if (!r.updatedAt) return true;
                    return new Date(r.updatedAt).getTime() >= startTime;
                });
            }
        }

        return list;
    });

    // Chart Configuration
    public lineChartData: ChartData<'line'> = {
        labels: [],
        datasets: []
    };

    public lineChartOptions: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' }
        },
        elements: {
            line: { tension: 0.4 } // Curves
        }
    };

    ngOnInit() {
        this.loadRoutes();
        this.loadFailures();
        this.loadCountries();
    }

    loadCountries() {
        this.paymentService.getPaymentCountries().subscribe({
            next: (data) => this.countries.set(data),
            error: (err) => console.error('Error loading countries:', err)
        });
    }

    loadRoutes() {
        this.monitoringService.getRoutes().subscribe({
            next: (data) => {
                const enrichedRoutes = data.map(route => ({
                    ...route,
                    successRate: route.failureRate !== undefined ? `${((1 - route.failureRate) * 100).toFixed(1)}%` : '100%',
                    countryName: this.getCountry(route.country || route.countryName || null)
                }));
                this.routes.set(enrichedRoutes);
                // After loading routes, load failures to potentially further enrich country info
                this.loadFailures();
            },
            error: (err) => console.error('Error loading routes:', err)
        });
    }

    // Actions
    triggerCheck() {
        this.monitoringService.checkRoutes().subscribe((routes) => {
            const enriched = routes.map(r => ({
                ...r,
                successRate: r.failureRate !== undefined ? `${((1 - r.failureRate) * 100).toFixed(1)}%` : '100%',
                countryName: this.getCountry(r.country || r.countryName || null)
            }));
            this.routes.set(enriched);
            this.loadFailures(); // Refresh enrichment from recent payments
        });
    }

    // Filter Setters
    setPeriod(event: any) { this.selectedPeriod.set(event.target.value); }
    setProviderFilter(event: any) { this.selectedProvider.set(event.target.value); }
    setCountryFilter(event: any) { this.selectedCountry.set(event.target.value); }

    filterRoutesByStatus(status: 'ACTIVE' | 'DEGRADED' | 'DOWN') {
        // Toggle if clicking same
        if (this.selectedStatusFilter() === status) {
            this.selectedStatusFilter.set(null);
        } else {
            this.selectedStatusFilter.set(status);
        }
    }

    setFailurePeriod(period: string) {
        this.failurePeriod.set(period);
        this.loadFailures(); // Refresh chart with new period
    }

    loadFailures() {
        this.paymentService.getRecentPayments().subscribe({
            next: (payments: any[]) => {
                // 1. Normalisation comme dans Dashboard
                const normalized = payments.map((p: any) => {
                    const data = p.payment ? p.payment : p;
                    let rName = 'N/A';
                    if (data.routeName) rName = data.routeName;
                    else if (p.routeName) rName = p.routeName;
                    else if (data.route) rName = typeof data.route === 'object' ? data.route.name : data.route;
                    else if (p.route) rName = typeof p.route === 'object' ? p.route.name : p.route;

                    return {
                        ...data,
                        extractedRouteName: rName,
                        extractedCountry: data.country || data.countryName || p.country || p.countryName
                    };
                });

                // 2. Mise à jour des routes avec les infos de pays issues des paiements
                const currentRoutes = this.routes();

                // Analyse des paiements pour calculer des métriques par route (ex: fallback usage)
                const hasUsedFallbackFlag = normalized.some(p => (p as any).usedFallback !== undefined);
                const statsByRoute = new Map<string, { total: number; fallback: number }>();

                if (hasUsedFallbackFlag) {
                    normalized.forEach(p => {
                        const routeName = p.extractedRouteName || null;
                        if (!routeName) return;
                        const key = String(routeName);
                        const existing = statsByRoute.get(key) || { total: 0, fallback: 0 };
                        existing.total += 1;
                        if ((p as any).usedFallback) existing.fallback += 1;
                        statsByRoute.set(key, existing);
                    });
                }

                const enriched = currentRoutes.map(route => {
                    // On cherche un paiement qui a utilisé cette route pour inférer le pays si manquant
                    const sample = normalized.find(p =>
                        p.extractedRouteName === route.name ||
                        (p.provider === route.provider && p.operator === route.operator)
                    );

                    const countrySource = sample?.extractedCountry || route.country || route.countryName || null;

                    const routeStats = statsByRoute.get(route.name || '') || null;
                    const fallbackRate = routeStats && routeStats.total > 0 ? (routeStats.fallback / routeStats.total) : undefined;

                    return {
                        ...route,
                        countryName: this.getCountry(countrySource),
                        // Ne définir fallbackRate que si on a des données issues des paiements
                        ...(fallbackRate !== undefined ? { fallbackRate } : {})
                    };
                });

                this.routes.set(enriched);
                this.processChartData(normalized);
            },
            error: (err) => console.error('Error loading payments for chart:', err)
        });
    }

    processChartData(payments: any[]) {
        const period = this.failurePeriod();
        const now = new Date();
        const labels: string[] = [];
        const datasets = {
            timeout: [] as number[],
            apiError: [] as number[],
            opReject: [] as number[],
            funds: [] as number[]
        };

        // Determine Time Buckets
        let buckets = 0;
        let bucketSizeMs = 0;
        let formatLabel: (d: Date) => string;

        if (period === '24h') {
            buckets = 12; // every 2 hours
            bucketSizeMs = 2 * 60 * 60 * 1000;
            formatLabel = (d) => `${d.getHours()}h`;
        } else if (period === 'week') {
            buckets = 7; // daily
            bucketSizeMs = 24 * 60 * 60 * 1000;
            formatLabel = (d) => ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][d.getDay()];
        } else { // month or year
            buckets = 4; // weekly (approx)
            bucketSizeMs = 7 * 24 * 60 * 60 * 1000;
            formatLabel = (d) => `S${Math.ceil(d.getDate() / 7)}`;
        }

        // Initialize buckets
        const endTime = now.getTime();
        const startTime = endTime - (buckets * bucketSizeMs);

        for (let i = 0; i < buckets; i++) {
            const time = new Date(startTime + i * bucketSizeMs);
            labels.push(formatLabel(time));
            datasets.timeout.push(0);
            datasets.apiError.push(0);
            datasets.opReject.push(0);
            datasets.funds.push(0);
        }

        // Fill buckets with payment failures
        payments.forEach(p => {
            const data: Payment = p.payment ? p.payment : p;
            if (data.status !== 'FAILED') return;

            const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0;
            if (createdAt < startTime) return;

            // Find bucket index
            const index = Math.floor((createdAt - startTime) / bucketSizeMs);
            if (index >= 0 && index < buckets) {
                const errorType = data.errorType;
                const reason = (data.providerResponse || data.failureReason || '').toLowerCase();

                if (errorType === ErrorType.TIMEOUT || reason.includes('timeout')) {
                    datasets.timeout[index]++;
                } else if (errorType === ErrorType.BALANCE_INSUFFICIENT || errorType === ErrorType.LIMIT_EXCEEDED || reason.includes('balanc') || reason.includes('fond') || reason.includes('insufficient')) {
                    datasets.funds[index]++;
                } else if (reason.includes('reject') || reason.includes('refus')) {
                    datasets.opReject[index]++;
                } else {
                    // Default to API Error for other failures (Network, Auth, Provider Down, etc.)
                    datasets.apiError[index]++;
                }
            }
        });

        this.lineChartData = {
            labels: labels,
            datasets: [
                {
                    data: datasets.timeout,
                    label: 'Timeout',
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245,158,11,0.2)',
                    tension: 0.4,
                    fill: 'origin'
                },
                {
                    data: datasets.apiError,
                    label: 'API Error',
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239,68,68,0.2)',
                    tension: 0.4,
                    fill: 'origin'
                },
                {
                    data: datasets.opReject,
                    label: 'Operator Reject',
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139,92,246,0.2)',
                    tension: 0.4,
                    fill: 'origin'
                },
                {
                    data: datasets.funds,
                    label: 'Fonds Insuffisants',
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59,130,246,0.2)',
                    tension: 0.4,
                    fill: 'origin'
                }
            ]
        };
    }

    // Helpers for Template
    getCountry(value: any): string {
        if (!value) return 'N/A';

        let raw = '';
        if (typeof value === 'object') {
            raw = value.countryName || value.country || value.name || '';
        } else {
            raw = value;
        }

        const name = raw.toUpperCase();
        if (name.includes('SN') || name.includes('SENEGAL') || name.includes('SÉNÉGAL')) return 'Sénégal';
        if (name.includes('CI') || name.includes('COTE') || name.includes('CÔTE') || name.includes('IVORY')) return 'Côte d\'Ivoire';
        if (name.includes('ML') || name.includes('MALI')) return 'Mali';
        if (name.includes('BF') || name.includes('BURKINA')) return 'Burkina Faso';
        if (name.includes('BJ') || name.includes('BN') || name.includes('BENIN')) return 'Bénin';
        if (name.includes('TG') || name.includes('TOGO')) return 'Togo';
        if (name.includes('GN') || name.includes('GUINEE') || name.includes('GUINEA')) return 'Guinée';
        if (name.includes('CM') || name.includes('CAMEROUN')) return 'Cameroun';

        return raw || 'International';
    }
    getFallbackRate(route: Route): string {
        if (route.fallbackRate !== undefined) {
            return `${(route.fallbackRate * 100).toFixed(1)}%`;
        }
        // If backend did not provide a fallback rate, show N/A to indicate unknown
        return 'N/A';
    }

    getLastFailure(route: Route): string {
        // 1. Priorité aux erreurs techniques réelles
        if (route.lastErrorType && route.lastErrorMessage) {
            return `[${route.lastErrorType}] ${route.lastErrorMessage}`;
        }
        if (route.lastErrorType || route.lastErrorMessage) {
            return route.lastErrorType || route.lastErrorMessage || '-';
        }

        // 2. Si pas d'erreur technique mais route dégradée, on explique pourquoi
        if (route.availability) {
            if (route.avgLatency > 1000) return 'Latence élevée (>1s)';
            if (route.failureRate && route.failureRate > 0.1) return `Taux d'échec élevé (${(route.failureRate * 100).toFixed(1)}%)`;
        }

        return '-';
    }

    getLastUpdate(route: Route): string {
        if (!route.updatedAt) return 'À l\'instant';
        return new Date(route.updatedAt).toLocaleTimeString();
    }

    toggleRouteAction(route: Route) {
        if (!route.id) return;

        const newStatus = !route.availability;
        this.monitoringService.toggleRoute(route.id, newStatus).subscribe({
            next: (updatedRoute) => {
                // Mettre à jour localement la liste
                this.routes.update(list => list.map(r => r.id === route.id ? { ...r, availability: newStatus } : r));
            },
            error: (err) => {
                console.error('Erreur lors du toggle route:', err);
                // Optionnel: afficher une notification d'erreur
            }
        });
    }

    getRouteStatus(route: Route): string {
        const status = this.getCanonicalStatus(route);
        if (status === 'DOWN') return 'Down';
        if (status === 'DEGRADED') return 'Dégradé';
        return 'Stable';
    }

    getOperatorIcon(operator: string): string {
        const op = (operator || '').toUpperCase();
        if (op.includes('ORANGE')) return 'phone_android';
        if (op.includes('WAVE')) return 'account_balance_wallet';
        if (op.includes('MOOV')) return 'cell_tower';
        if (op.includes('MTN')) return 'settings_phone';
        if (op.includes('FREE')) return 'wifi';
        return 'payments';
    }

    isRefreshing = signal(false);

    updateChart() {
        this.loadFailures();
    }
}
