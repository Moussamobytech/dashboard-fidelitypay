
import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PaymentService } from '../../core/services/payment.service';
import { Payment, PaymentStatus } from '../../core/models/payment.model';
import { FormsModule } from '@angular/forms';
// Force rebuild to pick up interface changes

@Component({
    selector: 'app-transactions',
    standalone: true,
    imports: [CommonModule, FormsModule],
    template: `
    <div class="page-header">
        <div class="header-content">
            <h1>Transactions</h1>
            <p class="subtitle">Historique et détails des transactions</p>
        </div>
    </div>

    <div class="card filters-card">
        <div class="filter-group">
            <label>Période</label>
            <select (change)="setPeriod($event)">
                <option value="24h">Aujourd'hui</option>
                <option value="week">Cette semaine</option>
                <option value="month">Ce mois</option>
                <option value="year">Cette année</option>
            </select>
        </div>
        <div class="filter-group">
            <label>Pays</label>
            <select (change)="setCountry($event)">
                <option value="">Tous</option>
                @for(c of countries(); track c) {
                    <option [value]="c">{{getCountry(c)}}</option>
                }
            </select>
        </div>
        <div class="filter-group">
            <label>Provider</label>
            <select (change)="setProvider($event)">
                <option value="">Tous</option>
                @for(p of providers(); track p) {
                    <option [value]="p">{{p}}</option>
                }
            </select>
        </div>
        <div class="filter-group">
            <label>Opérateur</label>
            <select (change)="setOperator($event)">
                <option value="">Tous</option>
                @for(op of operators(); track op) {
                    <option [value]="op">{{op}}</option>
                }
            </select>
        </div>
        <div class="filter-group">
            <label>Status</label>
            <select (change)="setStatus($event)">
                <option value="">Tous</option>
                <option value="SUCCESS">Succès</option>
                <option value="FAILED">Échec</option>
                <option value="PENDING">En cours</option>
            </select>
        </div>
    </div>

    <div class="card table-card">
        <div class="table-container">
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Pays</th>
                        <th>Opérateur</th>
                        <th>Provider</th>
                        <th>Route</th>
                        <th>Montant</th>
                        <th>Status</th>
                        <th>Latence</th>
                        <th>Heure</th>
                    </tr>
                </thead>
                <tbody>
                    @for (txn of filteredTransactions(); track txn.paymentId) {
                    <tr>
                        <td class="mono">{{ txn.paymentId.substring(0, 8) }}</td>
                        <td>{{ $any(txn).countryName || 'N/A' }}</td>
                        <td>{{ txn.operator }}</td>
                        <td>
                             <span class="badge provider" [attr.data-provider]="txn.provider">{{ txn.provider }}</span>
                        </td>
                        <td>{{ txn.routeName || 'N/A' }}</td>
                        <td class="amount">{{ txn.amount }} {{ txn.currency }}</td>
                        <td>
                            <span class="badge status" [class]="txn.status.toLowerCase()">{{ txn.status }}</span>
                        </td>
                        <td class="mono">{{ getLatency(txn) }}</td>
                        <td>{{ formatTime(txn.createdAt) }}</td>
                    </tr>
                    }
                    @if (filteredTransactions().length === 0) {
                        <tr><td colspan="9" class="empty">Aucune transaction trouvée</td></tr>
                    }
                </tbody>
            </table>
        </div>
    </div>
    `,
    styleUrls: ['./transactions.scss']
})
export class TransactionsComponent implements OnInit {
    private paymentService = inject(PaymentService);

    transactions = signal<Payment[]>([]);

    // Filters
    period = signal('24h');
    provider = signal('');
    operator = signal('');
    status = signal('');
    country = signal('');

    // Derived
    operators = computed(() => [...new Set(this.transactions().map(t => t.operator).filter(op => !!op))].sort());
    providers = computed(() => [...new Set(this.transactions().map(t => t.provider).filter(p => !!p))].sort());
    countries = signal<string[]>([]);

    filteredTransactions = computed(() => {
        let list = this.transactions();

        // 1. Period
        const now = new Date().getTime();
        const p = this.period();
        let startTime = 0;
        if (p === '24h') startTime = now - 24 * 3600 * 1000;
        else if (p === 'week') startTime = now - 7 * 24 * 3600 * 1000;
        else if (p === 'month') startTime = now - 30 * 24 * 3600 * 1000;
        else if (p === 'year') startTime = now - 365 * 24 * 3600 * 1000;

        if (startTime > 0) {
            list = list.filter(t => new Date(t.createdAt || 0).getTime() >= startTime);
        }

        // 2. Provider
        if (this.provider()) {
            list = list.filter(t => t.provider === this.provider());
        }

        // 3. Operator
        if (this.operator()) {
            list = list.filter(t => t.operator === this.operator());
        }

        // 4. Status
        if (this.status()) {
            list = list.filter(t => t.status === this.status());
        }

        // 5. Country
        if (this.country()) {
            const filterPretty = this.getCountry(this.country()).toUpperCase();
            list = list.filter(t =>
                this.getCountry((t as any).country || (t as any).countryName || (t as any).routeName).toUpperCase() === filterPretty
            );
        }

        return list;
    });

    ngOnInit() {
        this.loadTransactions();
        this.loadCountries();
    }


    loadCountries() {
        this.paymentService.getPaymentCountries().subscribe({
            next: (data) => this.countries.set(data),
            error: (err) => console.error('Error loading countries:', err)
        });
    }

    loadTransactions() {
        this.paymentService.getRecentPayments().subscribe({
            next: (data: any[]) => {
                // Flatten and merge DTO fields if present
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
                        countryName: this.getCountry(payment.country || routeName)
                    } as Payment;
                });
                this.transactions.set(flattened);
            },
            error: (err) => console.error(err)
        });
    }

    setPeriod(e: any) { this.period.set(e.target.value); }
    setProvider(e: any) { this.provider.set(e.target.value); }
    setOperator(e: any) { this.operator.set(e.target.value); }
    setStatus(e: any) { this.status.set(e.target.value); }

    setCountry(e: any) { const v = e.target.value; this.country.set(v); }

    getLatency(txn: any): string {
        const l = txn.providerResponseTimeMs ?? txn.latence ?? txn.routeLatency ?? 0;
        return l > 0 ? `${l.toFixed(0)}ms` : '-';
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

    formatTime(dateStr?: string): string {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString();
    }
}
