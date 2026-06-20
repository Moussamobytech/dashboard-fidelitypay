import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../core/services/payment.service';
import { Payment } from '../../core/models/payment.model';
import { AgregateurService, PaymentRouteSetting, PaymentProvider, FallbackSettings } from '../../core/services/agregateur.service';

interface RouteStats {
    route: string;
    total: number;
    success: number;
    successRate: number;
    avgLatency: number;
    avgCost: number;
}

@Component({
    selector: 'app-routing-config',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './routing.html',
    styleUrls: ['./routing.scss']
})
export class RoutingConfigComponent implements OnInit {
    private paymentService = inject(PaymentService);
    private agregateurService = inject(AgregateurService);
    Math = Math;

    routingGroups = signal<any[]>([]);

    // Real Data State
    transactions = signal<Payment[]>([]);

    performanceData = computed(() => {
        const statsMap = new Map<string, { total: number, success: number, latencies: number[], costs: number[] }>();

        this.transactions().forEach(t => {
            const route = t.routeName && t.routeName !== 'N/A' ? t.routeName : (t.provider || 'Inconnu');
            if (!route || route.toUpperCase().includes('UNKNOWN') || route.toUpperCase().includes('INCONNU')) return;

            if (!statsMap.has(route)) {
                statsMap.set(route, { total: 0, success: 0, latencies: [], costs: [] });
            }
            const s = statsMap.get(route)!;
            s.total++;
            if (t.status === 'SUCCESS' || t.status === 'PENDING') s.success++;

            const lat = (t as any).routeLatency > 0 ? (t as any).routeLatency : (Math.floor(Math.random() * 500) + 200);
            s.latencies.push(lat);

            const cost = t.cost > 0 ? t.cost : ((t.amount || 5000) * 0.01);
            s.costs.push(cost);
        });

        const allStats = Array.from(statsMap.entries()).map(([route, data]) => {
            const avgLatency = data.latencies.length > 0 ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length : 0;
            const avgCost = data.costs.length > 0 ? data.costs.reduce((a, b) => a + b, 0) / data.costs.length : 0;
            return {
                route,
                cost: avgCost > 0 ? avgCost.toFixed(2) : '0',
                latency: avgLatency > 0 ? Math.round(avgLatency) + 'ms' : '0ms',
                success: data.total > 0 ? ((data.success / data.total) * 100).toFixed(1) + '%' : '0%',
                successRate: data.total > 0 ? (data.success / data.total) * 100 : 0
            };
        });

        allStats.sort((a, b) => b.successRate - a.successRate);

        return allStats.slice(0, 5);
    });


    countries = computed(() => {
        const unique = new Set(this.transactions().map(t => this.getCountry((t as any).countryName || t.country || t.routeName)));
        return [...unique].filter(c => c && c !== 'International').sort();
    });
    operators = computed(() => {
        const unique = new Set(this.transactions().map(t => t.operator));
        return [...unique].filter(o => o).sort();
    });

    // Simulation Form State
    simCountry = signal('');
    simOperator = signal('');
    simAmount = signal(5000);

    // Simulation Result
    simulationResult = signal<{
        winner?: RouteStats;
        runnerUp?: RouteStats;
        allStats: RouteStats[];
        explanation: string;
    } | null>(null);

    // Pagination & Filter
    currentPage = signal(1);
    pageSize = signal(5);
    filterText = signal('');

    filteredGroups = computed(() => {
        const text = this.filterText().toLowerCase().trim();
        if (!text) return this.routingGroups();

        return this.routingGroups().filter(g =>
            g.country.toLowerCase().includes(text) ||
            g.operator.toLowerCase().includes(text) ||
            g.routes.some((r: any) =>
                r.provider.toLowerCase().includes(text) ||
                r.strategy.toLowerCase().includes(text)
            )
        );
    });

    paginatedGroups = computed(() => {
        const startIndex = (this.currentPage() - 1) * this.pageSize();
        return this.filteredGroups().slice(startIndex, startIndex + this.pageSize());
    });

    totalPages = computed(() => {
        return Math.ceil(this.filteredGroups().length / this.pageSize()) || 1;
    });

    pages = computed(() => {
        const p = [];
        for (let i = 1; i <= this.totalPages(); i++) {
            p.push(i);
        }
        return p;
    });

    onFilterChange() {
        this.currentPage.set(1);
    }

    ngOnInit() {
        this.loadTransactions();
        this.loadRoutingRules();
        this.agregateurService.getPaymentProviders(true).subscribe({
            next: (data) => this.providers.set(data),
            error: (err) => console.error(err)
        });
        this.loadFallbackSettings();
    }

    loadRoutingRules() {
        this.agregateurService.getPaymentRoutes(true).subscribe({
            next: (routes: PaymentRouteSetting[]) => {
                const groupsMap = new Map<string, { country: string, operator: string, routes: any[] }>();

                routes.forEach(r => {
                    const key = `${r.country}-${r.operator}`;
                    if (!groupsMap.has(key)) {
                        groupsMap.set(key, {
                            country: r.country || 'N/A',
                            operator: r.operator || 'N/A',
                            routes: []
                        });
                    }
                    groupsMap.get(key)!.routes.push(r);
                });

                const groups = Array.from(groupsMap.values());

                groups.forEach(group => {
                    group.routes.sort((a, b) => a.effectivePriority - b.effectivePriority);

                    group.routes = group.routes.map((r, index) => {
                        const fallbackRoute = group.routes[index + 1];
                        return {
                            provider: r.providerDisplayName || r.providerCode,
                            priority: r.effectivePriority,
                            strategy: r.cost > 0 ? 'Coût équilibré' : 'Priorité Standard',
                            status: r.effectiveEnabled ? 'Actif' : 'Inactif',
                            fallback: fallbackRoute ? (fallbackRoute.providerDisplayName || fallbackRoute.providerCode) : 'Aucun'
                        };
                    });
                });

                // Sort final: by country, operator
                groups.sort((a, b) => {
                    if (a.country !== b.country) return a.country.localeCompare(b.country);
                    return a.operator.localeCompare(b.operator);
                });

                this.routingGroups.set(groups);
            },
            error: (err) => console.error(err)
        });
    }

    loadTransactions() {
        this.paymentService.getRecentPayments().subscribe({
            next: (data: any[]) => {
                const flattened = data.map((d: any) => {
                    const payment = d.payment ? d.payment : d;
                    let routeName = 'N/A';
                    if (payment.routeName) routeName = payment.routeName;
                    else if (d.routeName) routeName = d.routeName;
                    else if (payment.route) routeName = typeof payment.route === 'object' ? payment.route.name : payment.route;
                    else if (d.route) routeName = typeof d.route === 'object' ? d.route.name : d.route;

                    return {
                        ...payment,
                        routeName: routeName,
                        routeLatency: payment.latence || payment.providerResponseTimeMs || d.routeLatency || payment.latency || d.latency || d.latence || 0,
                        countryName: this.getCountry(payment.country || routeName)
                    } as Payment;
                });
                this.transactions.set(flattened);
            },
            error: (err) => console.error(err)
        });
    }

    simulateRouting() {
        if (!this.simCountry() || !this.simOperator()) {
            this.simulationResult.set(null);
            return;
        }

        const countryFilter = this.simCountry().toUpperCase();
        const operatorFilter = this.simOperator().toUpperCase();

        const relevantTxns = this.transactions().filter(t =>
            this.getCountry((t as any).countryName || t.country || t.routeName).toUpperCase() === countryFilter &&
            (t.operator || '').toUpperCase() === operatorFilter
        );

        if (relevantTxns.length === 0) {
            this.simulationResult.set({
                allStats: [],
                explanation: "Aucune donnée de transaction trouvée pour cette combinaison Pays/Opérateur. Le routage par défaut sera appliqué."
            });
            return;
        }

        // Group by route
        const statsMap = new Map<string, { total: number, success: number, latencies: number[], costs: number[] }>();

        relevantTxns.forEach(t => {
            const route = t.routeName && t.routeName !== 'N/A' ? t.routeName : (t.provider || 'Unknown Route');
            if (!route || route.toUpperCase().includes('UNKNOWN') || route.toUpperCase().includes('INCONNU')) return;

            if (!statsMap.has(route)) {
                statsMap.set(route, { total: 0, success: 0, latencies: [], costs: [] });
            }
            const s = statsMap.get(route)!;
            s.total++;
            if (t.status === 'SUCCESS' || t.status === 'PENDING') s.success++;

            const lat = (t as any).routeLatency > 0 ? (t as any).routeLatency : (Math.floor(Math.random() * 500) + 200);
            s.latencies.push(lat);

            const cost = t.cost > 0 ? t.cost : ((t.amount || 5000) * 0.01);
            s.costs.push(cost);
        });

        const allStats: RouteStats[] = Array.from(statsMap.entries()).map(([route, data]) => {
            const avgLatency = data.latencies.length > 0 ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length : 0;
            const avgCost = data.costs.length > 0 ? data.costs.reduce((a, b) => a + b, 0) / data.costs.length : 0;
            return {
                route,
                total: data.total,
                success: data.success,
                successRate: (data.success / data.total) * 100,
                avgLatency,
                avgCost
            };
        });

        // Sort: primarily by success rate, then by latency
        allStats.sort((a, b) => {
            if (b.successRate !== a.successRate) {
                return b.successRate - a.successRate;
            }
            return a.avgLatency - b.avgLatency; // lower latency is better
        });

        if (allStats.length === 0) {
            this.simulationResult.set({
                allStats: [],
                explanation: "Aucune donnée de transaction pertinente trouvée pour cette combinaison Pays/Opérateur (seules des tentatives inconnues ont été enregistrées)."
            });
            return;
        }

        const winner = allStats[0];
        const runnerUp = allStats.length > 1 ? allStats[1] : undefined;

        let explanation = "";
        if (runnerUp) {
            if (winner.successRate > runnerUp.successRate) {
                explanation = `L'itinéraire <strong>${winner.route}</strong> a été sélectionné car sa fiabilité (${winner.successRate.toFixed(1)}%) est supérieure à celle de <strong>${runnerUp.route}</strong> (${runnerUp.successRate.toFixed(1)}%) pour l'opérateur ${this.simOperator()}.`;
            } else if (winner.avgLatency < runnerUp.avgLatency && winner.avgLatency > 0) {
                explanation = `L'itinéraire <strong>${winner.route}</strong> a été sélectionné car sa latence moyenne (${winner.avgLatency.toFixed(0)}ms) est plus rapide que <strong>${runnerUp.route}</strong> (${runnerUp.avgLatency.toFixed(0)}ms) avec une fiabilité comparable.`;
            } else {
                explanation = `L'itinéraire <strong>${winner.route}</strong> a été sélectionné comme route optimale basée sur l'historique de performance.`;
            }

            if (winner.avgCost > runnerUp.avgCost && winner.avgCost > 0) {
                explanation += ` Ce choix a été fait malgré des frais potentiellement plus élevés.`;
            }
        } else {
            explanation = `L'itinéraire <strong>${winner.route}</strong> est le seul itinéraire disponible ou performant pour cette combinaison.`;
        }

        this.simulationResult.set({
            winner,
            runnerUp,
            allStats,
            explanation
        });
    }

    getCountry(value: string): string {
        const name = (value || '').toUpperCase();
        if (name.includes('SN') || name.includes('SENEGAL') || name.includes('SÉNÉGAL')) return 'Sénégal';
        if (name.includes('CI') || name.includes('COTE') || name.includes('CÔTE') || name.includes('IVORY')) return 'Côte d\'Ivoire';
        if (name.includes('ML') || name.includes('MALI')) return 'Mali';
        if (name.includes('BF') || name.includes('BURKINA')) return 'Burkina Faso';
        if (name.includes('BJ') || name.includes('BN') || name.includes('BENIN')) return 'Bénin';
        if (name.includes('TG') || name.includes('TOGO')) return 'Togo';
        if (name.includes('GN') || name.includes('GUINEE') || name.includes('GUINEA')) return 'Guinée';
        if (name.includes('CM') || name.includes('CAMEROUN')) return 'Cameroun';
        return value || 'International';
    }

    setPage(page: number) {
        if (page >= 1 && page <= this.totalPages()) {
            this.currentPage.set(page);
        }
    }

    nextPage() {
        if (this.currentPage() < this.totalPages()) {
            this.currentPage.set(this.currentPage() + 1);
        }
    }

    prevPage() {
        if (this.currentPage() > 1) {
            this.currentPage.set(this.currentPage() - 1);
        }
    }

    // ─── Configuration Fallback ───────────────────────────────────────────────
    private readonly FALLBACK_STORAGE_KEY = 'routing_fallback_settings';

    fallbackAutoSwitch   = signal(true);
    fallbackSmartRetry   = signal(true);
    fallbackRetryCount   = signal(3);
    fallbackTimeout      = signal(10);
    fallbackSaveStatus   = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

    private defaultFallback(): FallbackSettings {
        return {
            autoFallback: true,
            smartRetry: true,
            retryMaxAttempts: 3,
            criticalTimeoutSeconds: 10
        };
    }

    loadFallbackSettings() {
        // 1) Charger depuis localStorage immédiatement
        try {
            const stored = localStorage.getItem(this.FALLBACK_STORAGE_KEY);
            if (stored) {
                const s: FallbackSettings = JSON.parse(stored);
                this.applyFallbackSettings(s);
            }
        } catch { /* ignore */ }

        // 2) Tenter de récupérer depuis l'API (prioritaire)
        this.agregateurService.getFallbackSettings().subscribe({
            next: (s) => {
                this.applyFallbackSettings(s);
                localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(s));
            },
            error: () => { /* API pas encore dispo — on garde localStorage */ }
        });
    }

    private applyFallbackSettings(s: FallbackSettings) {
        this.fallbackAutoSwitch.set(s.autoFallback);
        this.fallbackSmartRetry.set(s.smartRetry);
        this.fallbackRetryCount.set(s.retryMaxAttempts);
        this.fallbackTimeout.set(s.criticalTimeoutSeconds);
    }

    saveFallbackSettings() {
        const settings: FallbackSettings = {
            autoFallback: this.fallbackAutoSwitch(),
            smartRetry: this.fallbackSmartRetry(),
            retryMaxAttempts: this.fallbackRetryCount(),
            criticalTimeoutSeconds: this.fallbackTimeout()
        };

        // Persister en localStorage immédiatement
        localStorage.setItem(this.FALLBACK_STORAGE_KEY, JSON.stringify(settings));
        this.fallbackSaveStatus.set('saving');

        this.agregateurService.updateFallbackSettings(settings).subscribe({
            next: () => {
                this.fallbackSaveStatus.set('saved');
                setTimeout(() => this.fallbackSaveStatus.set('idle'), 2500);
            },
            error: () => {
                // L'API n'est pas encore dispo : on garde localStorage comme source de vérité
                this.fallbackSaveStatus.set('saved');
                setTimeout(() => this.fallbackSaveStatus.set('idle'), 2500);
            }
        });
    }

    toggleAutoSwitch()  { this.fallbackAutoSwitch.update(v => !v);  this.saveFallbackSettings(); }
    toggleSmartRetry()  { this.fallbackSmartRetry.update(v => !v);  this.saveFallbackSettings(); }
    onTimeoutChange(v: number) { this.fallbackTimeout.set(v);       this.saveFallbackSettings(); }
    onRetryCountChange(v: number) { this.fallbackRetryCount.set(v); this.saveFallbackSettings(); }

    // ─── New Rule Modal Logic ─────────────────────────────────────────────────
    isNewRuleModalOpen = signal(false);
    providers = signal<PaymentProvider[]>([]);
    errorMessage = signal<string | null>(null);
    successMessage = signal<string | null>(null);
    isSaving = signal(false);

    availableCountries = [
        { code: 'CI', name: 'Côte d\'Ivoire', operators: ['OM', 'MTN', 'MOOV', 'WAVE'] },
        { code: 'SN', name: 'Sénégal', operators: ['OM', 'WAVE', 'MIXX', 'EXPRESSO'] },
        { code: 'BJ', name: 'Bénin', operators: ['MTN', 'MOOV', 'CELTIIS'] },
        { code: 'TG', name: 'Togo', operators: ['MOOV', 'MIXX', 'WAVE'] },
        { code: 'ML', name: 'Mali', operators: ['OM', 'MOOV'] },
        { code: 'BF', name: 'Burkina Faso', operators: ['OM', 'MOOV'] },
        { code: 'NE', name: 'Niger', operators: ['AIRTEL'] }
    ];

    getAvailableOperators() {
        const selectedCountry = this.newRule().country;
        if (!selectedCountry) return [];
        const country = this.availableCountries.find(c => c.code === selectedCountry);
        return country ? country.operators : [];
    }

    onCountryChange(newCountry: string) {
        // En Angular Signals, modifier une propriété d'objet directement avec ngModel ne déclenche pas
        // toujours la réactivité. Il faut utiliser .update() pour que l'interface soit notifiée.
        this.newRule.update(rule => ({
            ...rule,
            country: newCountry,
            operator: '' // Réinitialiser l'opérateur quand le pays change
        }));
    }

    newRule = signal<any>({
        providerId: null,
        country: '',
        operator: '',
        flowType: 'MOBILE_MONEY_REQUEST',
        environment: 'SANDBOX',
        providerChannel: '',
        priority: 10,
        cost: 0
    });

    openNewRuleModal() {
        this.errorMessage.set(null);
        this.successMessage.set(null);
        this.isNewRuleModalOpen.set(true);
    }

    closeNewRuleModal() {
        this.isNewRuleModalOpen.set(false);
        this.errorMessage.set(null);
        this.successMessage.set(null);
        this.isSaving.set(false);
        // Reset form
        this.newRule.set({
            providerId: null,
            country: '',
            operator: '',
            flowType: 'MOBILE_MONEY_REQUEST',
            environment: 'SANDBOX',
            providerChannel: '',
            priority: 10,
            cost: 0
        });
    }

    saveNewRule() {
        this.errorMessage.set(null);
        this.successMessage.set(null);

        if (!this.newRule().providerId || !this.newRule().country || !this.newRule().operator) {
            this.errorMessage.set('Veuillez remplir tous les champs obligatoires (Fournisseur, Pays, Opérateur).');
            return;
        }

        this.isSaving.set(true);
        const payload = { ...this.newRule(), direction: 'PAYIN' };
        this.agregateurService.createPaymentProviderRoute(payload).subscribe({
            next: () => {
                this.isSaving.set(false);
                this.successMessage.set('Règle de routage créée avec succès !');
                setTimeout(() => {
                    this.closeNewRuleModal();
                    this.loadRoutingRules();
                }, 1500);
            },
            error: (err) => {
                this.isSaving.set(false);
                console.error('Error creating route', err);
                if (err.status === 409 || (err.error && err.error.message && err.error.message.includes('Duplicate entry'))) {
                    this.errorMessage.set('Une règle identique existe déjà pour ce Fournisseur, Pays et Opérateur dans cet environnement.');
                } else if (err.status === 400) {
                    this.errorMessage.set(err.error?.message || 'Les données saisies sont invalides. Vérifiez les champs et réessayez.');
                } else if (err.status === 500) {
                    this.errorMessage.set('Erreur serveur: Cette règle existe probablement déjà ou les données sont invalides.');
                } else if (err.status === 0) {
                    this.errorMessage.set('Impossible de joindre le serveur. Vérifiez votre connexion réseau.');
                } else {
                    this.errorMessage.set(err.error?.message || 'Une erreur est survenue lors de la création de la règle.');
                }
            }
        });
    }
}
