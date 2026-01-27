import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { PaymentService } from '../../core/services/payment.service';
import { Payment, PaymentStatus } from '../../core/models/payment.model';

@Component({
    selector: 'app-analytics',
    standalone: true,
    imports: [CommonModule, BaseChartDirective],
    templateUrl: './analytics.html',
    styleUrls: ['./analytics.scss']
})
export class AnalyticsComponent implements OnInit {
    private paymentService = inject(PaymentService);

    // Statistics
    totalVolume = 0;
    successRate = 0;
    activeAggregators = 2;
    avgLatency = 0;

    // Chart Configuration
    public barChartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    color: '#64748b',
                    font: { family: 'Inter', size: 12 }
                }
            },
            tooltip: {
                backgroundColor: '#0f172a',
                padding: 12,
                titleFont: { family: 'Outfit', size: 14 },
                bodyFont: { family: 'Inter', size: 13 }
            }
        },
        scales: {
            x: {
                grid: { display: false },
                ticks: { color: '#64748b' }
            },
            y: {
                grid: { color: '#e2e8f0' },
                ticks: { color: '#64748b' }
            }
        }
    };

    public barChartType: ChartType = 'bar';
    public kkiapayChartData: ChartData<'bar'> = {
        labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        datasets: [
            {
                data: [65, 59, 80, 81, 56, 55, 40],
                label: 'Volume Kkiapay',
                backgroundColor: '#6366f1',
                hoverBackgroundColor: '#4f46e5',
                borderRadius: 6
            }
        ]
    };

    public paydunyaChartData: ChartData<'bar'> = {
        labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        datasets: [
            {
                data: [28, 48, 40, 19, 86, 27, 90],
                label: 'Volume PayDunya',
                backgroundColor: '#10b981',
                hoverBackgroundColor: '#059669',
                borderRadius: 6
            }
        ]
    };

    ngOnInit(): void {
        this.loadData();
    }

    loadData() {
        this.paymentService.getRecentPayments().subscribe({
            next: (payments) => {
                this.calculateStats(payments);
            },
            error: (err) => {
                console.error('Error loading payments', err);
                // Fallback to mock calculation if API fails
                this.calculateStats([]);
            }
        });
    }

    calculateStats(payments: Payment[]) {
        if (payments.length === 0) {
            // Mock stats for demo if no real data
            this.totalVolume = 1250000;
            this.successRate = 98.4;
            this.avgLatency = 1.2;
            return;
        }

        this.totalVolume = payments.reduce((acc, p) => acc + p.amount, 0);
        const successPayments = payments.filter(p => p.status === PaymentStatus.SUCCESS).length;
        this.successRate = (successPayments / payments.length) * 100;

        const latencies = payments.filter(p => p.providerResponseTimeMs).map(p => p.providerResponseTimeMs!);
        if (latencies.length > 0) {
            this.avgLatency = Number((latencies.reduce((a, b) => a + b, 0) / latencies.length / 1000).toFixed(2));
        }
    }
}
