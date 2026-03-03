import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PaymentService } from '../../../core/services/payment.service';
import { DeveloperService, ApiKey } from '../../../core/services/developer.service';
import { Payment, PaymentStatus } from '../../../core/models/payment.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
    selector: 'app-developer-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './developer-dashboard.html',
    styleUrls: ['./developer-dashboard.scss']
})
export class DeveloperDashboardComponent implements OnInit {
    private developerService = inject(DeveloperService);
    private paymentService = inject(PaymentService);
    private authService = inject(AuthService);

    // Stats (même structure que le dashboard admin)
    stats = signal([
        { label: 'Volume traité', value: '0 FCFA', change: 'Mon compte', icon: 'payments', trend: 'neutral' },
        { label: 'Taux de succès', value: '0%', change: 'Mon compte', icon: 'check_circle', trend: 'neutral' },
        { label: 'Clés API actives', value: '0', change: 'Mon compte', icon: 'vpn_key', trend: 'neutral' },
        { label: 'Latence moyenne', value: '--', change: 'Mon compte', icon: 'speed', trend: 'neutral' },
    ]);

    recentTransactions = signal<any[]>([]);
    selectedPeriod = signal<'24h' | 'week' | 'month'>('24h');
    myKeys = signal<ApiKey[]>([]);

    private allPayments: Payment[] = [];

    ngOnInit() {
        this.developerService.getKeys().subscribe(keys => {
            this.myKeys.set(keys);
            // Mettre à jour la stat des clés actives
            const activeCount = keys.filter(k => k.isActive).length;
            this.stats.update(current => {
                const next = [...current];
                next[2] = { ...next[2], value: String(activeCount), trend: activeCount > 0 ? 'up' : 'neutral' };
                return next;
            });
        });

        this.loadMyPayments();
    }

    setPeriod(period: '24h' | 'week' | 'month') {
        this.selectedPeriod.set(period);
        this.calculateStats();
        this.updateRecentTransactionsList();
    }

    loadMyPayments(): void {
        const userId = this.authService.currentUser()?.userId;
        if (!userId) return;

        this.paymentService.getPaymentsByUser(userId).subscribe({
            next: (payments: any[]) => {
                this.allPayments = payments.map((p: any) => {
                    const data = p.payment ? p.payment : p;
                    return {
                        ...data,
                        createdAt: data.createdAt || new Date().toISOString(),
                        routeName: data.routeName || p.routeName || 'N/A',
                        providerResponseTimeMs: data.latence ?? data.providerResponseTimeMs ?? p.routeLatency ?? 0
                    };
                });
                this.updateRecentTransactionsList();
                this.calculateStats();
            },
            error: (err) => console.error('Error loading developer payments:', err)
        });
    }

    private updateRecentTransactionsList() {
        const period = this.selectedPeriod();
        const now = new Date().getTime();
        const oneDay = 24 * 60 * 60 * 1000;
        let startTime = 0;
        if (period === '24h') startTime = now - oneDay;
        else if (period === 'week') startTime = now - 7 * oneDay;
        else if (period === 'month') startTime = now - 30 * oneDay;

        const filtered = startTime > 0
            ? this.allPayments.filter(p => new Date(p.createdAt || 0).getTime() >= startTime)
            : this.allPayments;

        const mapped = filtered.slice(0, 20).map((data: any) => {
            const rawLatency = data.providerResponseTimeMs;
            const displayLatency = rawLatency > 0 ? `${(rawLatency / 1000).toFixed(2)}s` : '-';
            return {
                id: data.paymentId ? data.paymentId.substring(0, 8) : 'N/A',
                fullId: data.paymentId || 'N/A',
                amount: data.amount !== undefined ? `${data.amount.toLocaleString()} ${data.currency || 'F'}` : '0 F',
                countryName: this.getCountry(data.country || data.routeName),
                operator: data.operator || 'UNKNOWN',
                status: data.status || 'PENDING',
                time: this.formatTime(data.createdAt),
                provider: data.provider || 'UNKNOWN',
                routeHealth: data.sante || data.routeHealth || 'STABLE',
                latency: displayLatency
            };
        });

        this.recentTransactions.set(mapped);
    }

    calculateStats(): void {
        if (this.allPayments.length === 0) return;

        const period = this.selectedPeriod();
        const now = new Date();
        const oneDay = 24 * 60 * 60 * 1000;

        let startTime = now.getTime();
        if (period === '24h') startTime -= oneDay;
        else if (period === 'week') startTime -= 7 * oneDay;
        else if (period === 'month') startTime -= 30 * oneDay;

        const filtered = this.allPayments.filter(p => {
            const pDate = p.createdAt ? new Date(p.createdAt).getTime() : 0;
            return pDate >= startTime;
        });

        const totalVolume = filtered.reduce((sum, p) => p.status === PaymentStatus.SUCCESS ? sum + p.amount : sum, 0);
        const successCount = filtered.filter(p => p.status === PaymentStatus.SUCCESS).length;
        const totalCount = filtered.length;
        const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

        const latencies = filtered
            .map(p => p.providerResponseTimeMs)
            .filter((l): l is number => l !== undefined && l !== null && l > 0);
        const avgLatency = latencies.length > 0
            ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

        const activeKeys = this.myKeys().filter(k => k.isActive).length;

        this.stats.update(current => {
            const next = [...current];
            next[0] = { ...next[0], value: `${totalVolume.toLocaleString()} F`, trend: totalVolume > 0 ? 'up' : 'neutral' };
            next[1] = { ...next[1], value: `${successRate.toFixed(1)}%`, trend: successRate > 90 ? 'up' : successRate > 0 ? 'down' : 'neutral' };
            next[2] = { ...next[2], value: String(activeKeys), trend: activeKeys > 0 ? 'up' : 'neutral' };
            next[3] = { ...next[3], value: avgLatency > 0 ? `${(avgLatency / 1000).toFixed(2)}s` : '--', trend: avgLatency > 0 && avgLatency < 500 ? 'up' : 'neutral' };
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

    getCountry(value: string): string {
        const name = (value || '').toUpperCase();
        if (name.includes('SN') || name.includes('SENEGAL')) return 'Sénégal';
        if (name.includes('CI') || name.includes('COTE') || name.includes('IVORY')) return 'Côte d\'Ivoire';
        if (name.includes('ML') || name.includes('MALI')) return 'Mali';
        if (name.includes('BF') || name.includes('BURKINA')) return 'Burkina Faso';
        if (name.includes('BJ') || name.includes('BENIN')) return 'Bénin';
        if (name.includes('TG') || name.includes('TOGO')) return 'Togo';
        if (name.includes('GN') || name.includes('GUINEE')) return 'Guinée';
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
