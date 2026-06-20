import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PaymentService } from '../../../core/services/payment.service';
import { AuthService } from '../../../core/services/auth.service';
import { Payment, PaymentStatus } from '../../../core/models/payment.model';
import { FpSelectComponent, FpSelectOption, FpSelectValue } from '../../../shared/fp-select/fp-select';

@Component({
    selector: 'app-developer-transactions',
    standalone: true,
    imports: [CommonModule, FormsModule, FpSelectComponent],
    templateUrl: './developer-transactions.html',
    styleUrls: ['../../transactions/transactions.scss'] // Reuse main styles
})
export class DeveloperTransactionsComponent implements OnInit {
    private paymentService = inject(PaymentService);
    private authService = inject(AuthService);

    transactions = signal<Payment[]>([]);
    isLoading = signal(true);
    Math = Math;

    // Pagination
    currentPage = signal(1);
    pageSize = signal(10);

    // Filters
    period = signal('all');
    provider = signal('');
    operator = signal('');
    status = signal('');
    country = signal('');
    searchTerm = signal('');

    // Derived
    operators = computed(() => [...new Set(this.transactions().map(t => t.operator).filter(op => !!op))].sort());
    providers = computed(() => [...new Set(this.transactions().map(t => t.provider).filter(p => !!p))].sort());
    countries = signal<string[]>([]);
    periodOptions: FpSelectOption[] = [
        { value: 'all', label: 'Toutes' }, { value: '24h', label: 'Aujourd’hui' },
        { value: 'week', label: 'Cette semaine' }, { value: 'month', label: 'Ce mois' }
    ];
    statusOptions: FpSelectOption[] = [
        { value: '', label: 'Tous' }, { value: 'SUCCESS', label: 'Succès' },
        { value: 'FAILED', label: 'Échec' }, { value: 'PENDING', label: 'En cours' },
        { value: 'REQUIRES_ACTION', label: 'Action requise' }, { value: 'CANCELLED', label: 'Annulé' }
    ];
    countryOptions = computed<FpSelectOption[]>(() => [
        { value: '', label: 'Tous' },
        ...this.countries().map(country => ({ value: country, label: this.getCountry(country) }))
    ]);
    operatorOptions = computed<FpSelectOption[]>(() => [
        { value: '', label: 'Tous' },
        ...this.operators().map(operator => ({ value: operator, label: operator }))
    ]);

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

        const term = this.searchTerm().trim().toLowerCase();
        if (term) {
            list = list.filter(t => [
                t.countryName, t.country, t.operator, t.provider, t.status, t.flowType
            ].some(value => String(value || '').toLowerCase().includes(term)));
        }

        if (this.country()) {
            const filterPretty = this.getCountry(this.country()).toUpperCase();
            list = list.filter(t =>
                this.getCountry((t as any).country || (t as any).countryName || (t as any).routeName || '').toUpperCase() === filterPretty
            );
        }

        return list;
    });

    paginatedTransactions = computed(() => {
        const startIndex = (this.currentPage() - 1) * this.pageSize();
        return this.filteredTransactions().slice(startIndex, startIndex + this.pageSize());
    });

    totalPages = computed(() => {
        return Math.ceil(this.filteredTransactions().length / this.pageSize()) || 1;
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

    ngOnInit() {
        this.loadMyTransactions();
        this.loadCountries();
    }

    loadCountries() {
        this.paymentService.getPaymentCountries().subscribe({
            next: (data) => {
                const uniqueCountries = [...new Set(data.map(c => this.getCountry(c)))].sort();
                this.countries.set(uniqueCountries);
            },
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

                    // Robust extraction of route name
                    let routeName = 'N/A';
                    if (payment.routeName) routeName = payment.routeName;
                    else if (d.routeName) routeName = d.routeName;
                    else if (payment.route) {
                        routeName = typeof payment.route === 'object' ? payment.route.name : payment.route;
                    } else if (d.route) {
                        routeName = typeof d.route === 'object' ? d.route.name : d.route;
                    }

                    return {
                        ...payment,
                        routeName: routeName,
                        routeLatency: payment.providerResponseTimeMs || d.routeLatency || payment.latency || d.latency || 0,
                        countryName: this.getCountry(payment.country || routeName || '')
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

    setPeriod(value: FpSelectValue) { this.period.set(String(value)); this.currentPage.set(1); }
    setOperator(value: FpSelectValue) { this.operator.set(String(value)); this.currentPage.set(1); }
    setStatus(value: FpSelectValue) { this.status.set(String(value)); this.currentPage.set(1); }
    setCountry(value: FpSelectValue) { this.country.set(String(value)); this.currentPage.set(1); }

    setSearch(event: Event): void {
        this.searchTerm.set((event.target as HTMLInputElement).value);
        this.currentPage.set(1);
    }

    flowLabel(flowType?: string): string {
        switch (flowType) {
            case 'HOSTED_CHECKOUT': return 'Page de paiement';
            case 'WAVE_REDIRECT': return 'Redirection Wave';
            case 'ORANGE_CI_OTP': return 'OTP Orange';
            case 'MOBILE_MONEY_REQUEST': return 'Demande mobile';
            default: return 'Non renseigné';
        }
    }

    copyPaymentLink(transaction: Payment): void {
        if (transaction.paymentUrl) navigator.clipboard.writeText(transaction.paymentUrl);
    }

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
