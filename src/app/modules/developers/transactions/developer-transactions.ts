import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';
import { Payment, PaymentStatus } from '../../../core/models/payment.model';

@Component({
    selector: 'app-developer-transactions',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './developer-transactions.html',
    styleUrls: ['../../transactions/transactions.scss'] // Reuse main styles
})
export class DeveloperTransactionsComponent implements OnInit {
    private paymentService = inject(PaymentService);
    private authService = inject(AuthService);

    transactions = signal<Payment[]>([]);
    isLoading = signal(true);

    // Filters
    period = signal('all');
    provider = signal('');
    operator = signal('');
    status = signal('');
    country = signal('');

    // Derived
    operators = computed(() => [...new Set(this.transactions().map(t => t.operator).filter(op => !!op))].sort());
    providers = computed(() => [...new Set(this.transactions().map(t => t.provider).filter(p => !!p))].sort());
    countries = signal<string[]>([]);

    // Stats globales du compte
    totalVolume = computed(() =>
        this.transactions().reduce((sum, t) => sum + (t.amount || 0), 0)
    );
    successRate = computed(() => {
        const t = this.transactions();
        if (!t.length) return 0;
        const s = t.filter(tx => tx.status === PaymentStatus.SUCCESS).length;
        return Number((s / t.length * 100).toFixed(1));
    });

    filteredTransactions = computed(() => {
        let list = this.transactions();

        // 1. Period
        const now = new Date().getTime();
        const p = this.period();
        let startTime = 0;
        if (p === '24h') startTime = now - 24 * 3600 * 1000;
        else if (p === 'week') startTime = now - 7 * 24 * 3600 * 1000;
        else if (p === 'month') startTime = now - 30 * 24 * 3600 * 1000;

        if (startTime > 0) {
            list = list.filter(t => new Date(t.createdAt || 0).getTime() >= startTime);
        }

        // 2. Filters
        if (this.provider()) list = list.filter(t => t.provider === this.provider());
        if (this.operator()) list = list.filter(t => t.operator === this.operator());
        if (this.status()) list = list.filter(t => t.status === this.status());

        if (this.country()) {
            const filterPretty = this.getCountry(this.country()).toUpperCase();
            list = list.filter(t =>
                this.getCountry((t as any).country || (t as any).countryName || (t as any).routeName || '').toUpperCase() === filterPretty
            );
        }

        return list;
    });

    ngOnInit() {
        this.loadMyTransactions();
        this.loadCountries();
    }

    loadCountries() {
        this.paymentService.getPaymentCountries().subscribe({
            next: (data) => this.countries.set(data),
            error: (err) => console.error('Error loading countries:', err)
        });
    }

    loadMyTransactions() {
        const userId = this.authService.currentUser()?.userId;
        if (!userId) {
            this.isLoading.set(false);
            return;
        }

        this.isLoading.set(true);
        this.paymentService.getPaymentsByUser(userId).subscribe({
            next: (data: any[]) => {
                const flattened = data.map((d: any) => {
                    const payment = d.payment ? d.payment : d;
                    return {
                        ...payment,
                        routeLatency: payment.providerResponseTimeMs || d.routeLatency || payment.latency || 0,
                        countryName: this.getCountry(payment.country || payment.routeName || '')
                    } as Payment;
                });
                this.transactions.set(flattened);
                this.isLoading.set(false);
            },
            error: (err) => {
                console.error(err);
                this.isLoading.set(false);
            }
        });
    }

    setPeriod(e: any) { this.period.set(e.target.value); }
    setProvider(e: any) { this.provider.set(e.target.value); }
    setOperator(e: any) { this.operator.set(e.target.value); }
    setStatus(e: any) { this.status.set(e.target.value); }
    setCountry(e: any) { this.country.set(e.target.value); }

    getLatency(txn: any): string {
        const l = txn.providerResponseTimeMs ?? txn.latence ?? txn.routeLatency ?? 0;
        return l > 0 ? `${l.toFixed(0)}ms` : '-';
    }

    getCountry(value: string): string {
        const name = (value || '').toUpperCase();
        if (name.includes('SN') || name.includes('SENEGAL')) return 'Sénégal';
        if (name.includes('CI') || name.includes('COTE') || name.includes('IVORY')) return 'Côte d\'Ivoire';
        if (name.includes('ML') || name.includes('MALI')) return 'Mali';
        if (name.includes('BF') || name.includes('BURKINA')) return 'Burkina Faso';
        if (name.includes('BJ') || name.includes('BN') || name.includes('BENIN')) return 'Bénin';
        if (name.includes('TG') || name.includes('TOGO')) return 'Togo';
        if (name.includes('GN') || name.includes('GUINEE')) return 'Guinée';
        if (name.includes('CM') || name.includes('CAMEROUN')) return 'Cameroun';
        return value || 'N/A';
    }

    formatTime(dateStr?: string): string {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('fr-FR');
    }
}
