import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoringService } from '../../../core/services/monitoring.service';
import { PaymentService } from '../../../core/services/payment.service';
import { Route } from '../../../core/models/route.model';
import { Payment, PaymentStatus } from '../../../core/models/payment.model';

@Component({
    selector: 'app-dashboard-overview',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './overview.html',
    styleUrls: ['./overview.scss']
})
export class DashboardOverviewComponent implements OnInit {
    private monitoringService = inject(MonitoringService);
    private paymentService = inject(PaymentService);

    stats = signal([
        { label: 'Volume traité', value: '0 FCFA', change: 'En direct', icon: 'payments', trend: 'neutral' },
        { label: 'Taux de succès', value: '0%', change: 'En direct', icon: 'check_circle', trend: 'neutral' },
        { label: 'Taux succès fallback', value: '0%', change: 'En direct', icon: 'alt_route', trend: 'neutral' },
        { label: 'Latence moyenne', value: '0.00s', change: 'En direct', icon: 'speed', trend: 'neutral' },
    ]);

    recentTransactions = signal<any[]>([]);
    routesStatus = signal<any[]>([]);
    Math = Math;

    // Pagination
    currentPage = signal(1);
    pageSize = signal(10);

    // Store all loaded payments to filter them locally
    private allPayments: Payment[] = [];
    selectedPeriod = signal<'24h' | 'week' | 'month'>('24h');

    ngOnInit() {
        this.loadRoutes();
        this.loadRecentPayments();
    }

    setPeriod(period: '24h' | 'week' | 'month') {
        this.selectedPeriod.set(period);
        this.currentPage.set(1);
        this.calculateStats();
    }

    loadRecentPayments() {
        console.log('Loading recent payments...');
        this.paymentService.getRecentPayments().subscribe({
            next: (payments: Payment[]) => {
                console.log('Payments received:', payments);
                if (!payments || !Array.isArray(payments)) {
                    console.warn('Received invalid data format for payments');
                    return;
                }

                // Flatten/normalize payment data
                this.allPayments = payments.map((p: any) => {
                    const data = p.payment ? p.payment : p;

                    // Robust extraction of route name
                    let routeName = 'N/A';
                    if (data.routeName) routeName = data.routeName;
                    else if (p.routeName) routeName = p.routeName;
                    else if (data.route) {
                        routeName = typeof data.route === 'object' ? data.route.name : data.route;
                    } else if (p.route) {
                        routeName = typeof p.route === 'object' ? p.route.name : p.route;
                    }

                    return {
                        ...data,
                        // Ensure createdAt is available for filtering
                        createdAt: data.createdAt || new Date().toISOString(),
                        // Normalize route info
                        routeName: routeName,
                        // Normalize latency
                        providerResponseTimeMs: data.latence ??
                            data.providerResponseTimeMs ??
                            p.routeLatency ??
                            data.routeLatency ??
                            data.latency ??
                            data.duration ??
                            0
                    };
                });

                this.updateRecentTransactionsList();
                this.calculateStats();
            },
            error: (err) => {
                console.error('Error loading payments:', err);
            }
        });
    }

    private updateRecentTransactionsList() {
        // Map all payments for the dashboard table (we limit by pagination instead of .slice(0, 20))
        const mappedTxns = this.allPayments.map((data: any) => {
            const rawLatency = data.providerResponseTimeMs;
            const displayLatency = (rawLatency !== undefined && rawLatency !== null && rawLatency !== 0) ?
                `${(rawLatency / 1000).toFixed(2)}s` : '-';

            return {
                id: data.paymentId ? data.paymentId.substring(0, 8) : 'N/A',
                fullId: data.paymentId || 'N/A',
                amount: data.amount !== undefined ? `${data.amount.toLocaleString()} ${data.currency || 'F'}` : '0 F',
                countryName: this.getCountry(data.country || data.routeName),
                operator: data.operator || 'UNKNOWN',
                status: data.status || 'PENDING',
                time: this.formatTime(data.createdAt),
                route: data.routeName || data.route || 'N/A',
                provider: data.provider || 'UNKNOWN',
                routeHealth: data.sante || data.routeHealth || 'STABLE',
                latency: displayLatency
            };
        });

        this.recentTransactions.set(mappedTxns);
    }

    paginatedTransactions = computed(() => {
        const startIndex = (this.currentPage() - 1) * this.pageSize();
        return this.recentTransactions().slice(startIndex, startIndex + this.pageSize());
    });

    totalPages = computed(() => {
        return Math.ceil(this.recentTransactions().length / this.pageSize()) || 1;
    });

    pages = computed(() => {
        return [this.currentPage()];
    });

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

    calculateStats() {
        if (this.allPayments.length === 0) return;

        const period = this.selectedPeriod();
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;

        let startTime = now.getTime();
        if (period === '24h') startTime -= oneDay;
        else if (period === 'week') startTime -= 7 * oneDay;
        else if (period === 'month') startTime -= 30 * oneDay;

        const filteredPayments = this.allPayments.filter(p => {
            const pDate = p.createdAt ? new Date(p.createdAt).getTime() : 0;
            return pDate >= startTime;
        });

        const totalVolume = filteredPayments.reduce((sum, p) => p.status === PaymentStatus.SUCCESS ? sum + p.amount : sum, 0);
        const successCount = filteredPayments.filter(p => p.status === PaymentStatus.SUCCESS).length;
        const totalCount = filteredPayments.length;
        const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

        // If payments don't include an explicit `usedFallback` flag, treat fallback rate as unknown
        const hasUsedFallbackFlag = filteredPayments.some(p => (p as any).usedFallback !== undefined);
        const paymentsWithFallback = hasUsedFallbackFlag ? filteredPayments.filter(p => p.status === PaymentStatus.SUCCESS && (p as any).usedFallback).length : 0;
        const fallbackRate = hasUsedFallbackFlag && successCount > 0 ? (paymentsWithFallback / successCount) * 100 : NaN;

        const latencies = filteredPayments
            .map(p => p.providerResponseTimeMs)
            .filter((l): l is number => l !== undefined && l !== null && l > 0);

        const avgLatency = latencies.length > 0 ?
            latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

        this.stats.update(current => {
            const next = [...current];
            next[0] = { ...next[0], value: `${totalVolume.toLocaleString()} F`, trend: 'up' };
            next[1] = { ...next[1], value: `${successRate.toFixed(1)}%`, trend: successRate > 90 ? 'up' : 'down' };
            next[2] = { ...next[2], value: Number.isNaN(fallbackRate) ? 'N/A' : `${fallbackRate.toFixed(1)}%`, trend: (Number.isNaN(fallbackRate) || fallbackRate === 0) ? 'neutral' : 'up' };
            next[3] = { ...next[3], value: `${(avgLatency / 1000).toFixed(2)}s`, trend: avgLatency < 500 ? 'up' : 'down' };
            return next;
        });
    }

    formatTime(dateString?: string): string {
        if (!dateString) return '-';
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'À l\'instant';
        if (diffMins < 60) return `${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h`;
        return date.toLocaleDateString();
    }

    loadRoutes() {
        this.monitoringService.getRoutes().subscribe({
            next: (routes: Route[]) => {
                this.routesStatus.set(routes);
            },
            error: (err) => console.error('Dashboard Monitoring Error:', err)
        });
    }

    getCountry(value: string): string {
        const name = (value || '').toUpperCase();
        if (name.includes('SN') || name.includes('SENEGAL')) return 'Sénégal';
        if (name.includes('CI') || name.includes('COTE') || name.includes('IVORY')) return 'Côte d\'Ivoire';
        if (name.includes('ML') || name.includes('MALI')) return 'Mali';
        if (name.includes('BF') || name.includes('BURKINA')) return 'Burkina Faso';
        if (name.includes('BJ') || name.includes('BN') || name.includes('BENIN')) return 'Bénin';
        if (name.includes('TG') || name.includes('TOGO')) return 'Togo';
        if (name.includes('GN') || name.includes('GUINEE') || name.includes('GUINEA')) return 'Guinée';
        if (name.includes('CM') || name.includes('CAMEROUN')) return 'Cameroun';
        return value || 'International';
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
}


