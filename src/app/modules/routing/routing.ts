import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../core/services/payment.service';
import { Payment } from '../../core/models/payment.model';

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
    Math = Math;

    routingRules = signal([
        { country: 'Sénégal', operator: 'Orange Money', priority: 1, strategy: 'Coût minimum', status: 'Actif', fallback: 'Wave' },
        { country: 'Sénégal', operator: 'Wave', priority: 2, strategy: 'Latence minimum', status: 'Actif', fallback: 'PayDunya' },
        { country: 'Bénin', operator: 'Moov', priority: 1, strategy: 'Taux de succès', status: 'Alerte', fallback: 'Kkiapay' },
    ]);

    performanceData = [
        { route: 'Primary (Local API)', cost: '0.5%', latency: '0.8s', success: '99.5%' },
        { route: 'Aggregator (SamirPay)', cost: '2.0%', latency: '1.4s', success: '98.0%' },
        { route: 'Fallback (Backup Link)', cost: '1.5%', latency: '2.1s', success: '96.5%' },
    ];

    // Real Data State
    transactions = signal<Payment[]>([]);
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

    // Pagination
    currentPage = signal(1);
    pageSize = signal(10);

    paginatedRules = computed(() => {
        const startIndex = (this.currentPage() - 1) * this.pageSize();
        return this.routingRules().slice(startIndex, startIndex + this.pageSize());
    });

    totalPages = computed(() => {
        return Math.ceil(this.routingRules().length / this.pageSize()) || 1;
    });

    pages = computed(() => {
        return [this.currentPage()];
    });

    ngOnInit() {
        this.loadTransactions();
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
                        routeLatency: payment.providerResponseTimeMs || d.routeLatency || payment.latency || d.latency || 0,
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
            if (!statsMap.has(route)) {
                statsMap.set(route, { total: 0, success: 0, latencies: [], costs: [] });
            }
            const s = statsMap.get(route)!;
            s.total++;
            if (t.status === 'SUCCESS') s.success++;
            if ((t as any).routeLatency > 0) s.latencies.push((t as any).routeLatency);
            if (t.cost > 0) s.costs.push(t.cost);
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
}
