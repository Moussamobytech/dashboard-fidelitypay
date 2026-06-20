import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { AuthService } from '../../core/services/auth.service';
import { PaymentService } from '../../core/services/payment.service';
import { Payment, PaymentStatus } from '../../core/models/payment.model';

type FailureRow = {
    reason: string;
    count: number;
    share: number;
};

@Component({
    selector: 'app-analytics',
    standalone: true,
    imports: [CommonModule, BaseChartDirective],
    templateUrl: './analytics.html',
    styleUrls: ['./analytics.scss']
})
export class AnalyticsComponent implements OnInit {
    private authService = inject(AuthService);
    private paymentService = inject(PaymentService);

    payments = signal<Payment[]>([]);
    isLoading = signal(true);

    readonly chartType: ChartType = 'bar';
    readonly chartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top' },
            tooltip: { backgroundColor: '#0f172a', padding: 12 }
        },
        scales: {
            x: { grid: { display: false } },
            y: { beginAtZero: true, grid: { color: '#e2e8f0' } }
        }
    };

    totalVolume = computed(() =>
        this.payments()
            .filter(payment => payment.status === PaymentStatus.SUCCESS)
            .reduce((sum, payment) => sum + (payment.amount || 0), 0)
    );

    successRate = computed(() => {
        const payments = this.payments();
        if (!payments.length) return 0;
        const successful = payments.filter(payment => payment.status === PaymentStatus.SUCCESS).length;
        return Number((successful / payments.length * 100).toFixed(1));
    });

    failedCount = computed(() =>
        this.payments().filter(payment => payment.status === PaymentStatus.FAILED).length
    );

    uncertainCount = computed(() =>
        this.payments().filter(payment =>
            payment.status === PaymentStatus.PENDING ||
            payment.status === PaymentStatus.REQUIRES_ACTION ||
            payment.status === PaymentStatus.PENDING_RECONCILIATION
        ).length
    );

    avgLatency = computed(() => {
        const latencies = this.payments()
            .map(payment => payment.providerResponseTimeMs)
            .filter((value): value is number => value !== undefined && value !== null && value > 0);
        if (!latencies.length) return 0;
        return latencies.reduce((sum, value) => sum + value, 0) / latencies.length;
    });

    statusChartData = computed<ChartData<'bar'>>(() => {
        const statuses = ['SUCCESS', 'FAILED', 'PENDING', 'REQUIRES_ACTION', 'CANCELLED'];
        return {
            labels: statuses,
            datasets: [{
                label: 'Transactions',
                data: statuses.map(status => this.payments().filter(payment => payment.status === status).length),
                backgroundColor: ['#10b981', '#ef4444', '#f59e0b', '#6366f1', '#64748b'],
                borderRadius: 6
            }]
        };
    });

    providerChartData = computed<ChartData<'bar'>>(() => {
        const providers = Array.from(new Set(this.payments().map(payment => payment.provider || 'UNKNOWN'))).sort();
        return {
            labels: providers,
            datasets: [
                {
                    label: 'Succès',
                    data: providers.map(provider => this.payments().filter(payment => (payment.provider || 'UNKNOWN') === provider && payment.status === PaymentStatus.SUCCESS).length),
                    backgroundColor: '#10b981',
                    borderRadius: 6
                },
                {
                    label: 'Échecs',
                    data: providers.map(provider => this.payments().filter(payment => (payment.provider || 'UNKNOWN') === provider && payment.status === PaymentStatus.FAILED).length),
                    backgroundColor: '#ef4444',
                    borderRadius: 6
                }
            ]
        };
    });

    failureRows = computed<FailureRow[]>(() => {
        const failed = this.payments().filter(payment => payment.status === PaymentStatus.FAILED);
        const total = failed.length || 1;
        const grouped = failed.reduce<Record<string, number>>((acc, payment: any) => {
            const reason = payment.failureReason || payment.errorType || payment.providerErrorCode || 'Cause non classifiée';
            acc[reason] = (acc[reason] || 0) + 1;
            return acc;
        }, {});

        return Object.entries(grouped)
            .map(([reason, count]) => ({ reason, count, share: Number((count / total * 100).toFixed(1)) }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 6);
    });

    ngOnInit(): void {
        this.loadPayments();
    }

    loadPayments(): void {
        this.isLoading.set(true);
        const userId = this.authService.currentUser()?.userId;
        const request = this.authService.isAdmin()
            ? this.paymentService.getRecentPayments()
            : this.paymentService.getPaymentsByUser(userId || '');

        request.subscribe({
            next: payments => {
                this.payments.set((payments || []).map(payment => this.normalizePayment(payment)));
                this.isLoading.set(false);
            },
            error: () => {
                this.payments.set([]);
                this.isLoading.set(false);
            }
        });
    }

    formatMoney(value: number): string {
        return `${value.toLocaleString('fr-FR')} F`;
    }

    formatLatency(value: number): string {
        return value > 0 ? `${(value / 1000).toFixed(2)}s` : 'N/A';
    }

    private normalizePayment(raw: any): Payment {
        const payment = raw?.payment ? raw.payment : raw;
        return {
            ...payment,
            provider: payment.provider || raw?.provider || 'UNKNOWN',
            operator: payment.operator || raw?.operator || 'UNKNOWN',
            routeName: payment.routeName || raw?.routeName || payment.route?.name || raw?.route?.name || 'N/A',
            providerResponseTimeMs: payment.providerResponseTimeMs ?? payment.latence ?? raw?.routeLatency ?? payment.latency ?? 0
        } as Payment;
    }
}
