import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DeveloperService, ApiKey } from '../../core/services/developer.service';
import { PaymentService } from '../../core/services/payment.service';
import { Payment, PaymentStatus } from '../../core/models/payment.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
    selector: 'app-developers',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './developers.html',
    styleUrls: ['./developers.scss']
})
export class DevelopersComponent implements OnInit {
    private developerService = inject(DeveloperService);
    private paymentService = inject(PaymentService);
    private authService = inject(AuthService);

    currentEnvironment: 'sandbox' | 'live' = 'sandbox';
    allKeys = signal<ApiKey[]>([]);
    filteredKeys = signal<ApiKey[]>([]);
    firstKey = computed(() => this.filteredKeys().length > 0 ? this.filteredKeys()[0].publicKey : 'VOTRE_CLE_API');

    // Stats as signals for reactivity
    activeKeysCount = signal(0);
    apiCallsCount = signal(0);
    successRate = signal(0);
    avgLatency = signal(0);
    isAdmin = computed<boolean>(() => this.authService.isAdmin());

    ngOnInit(): void {
        const obs = this.isAdmin()
            ? this.developerService.getAllKeysAdmin()
            : this.developerService.getKeys();

        obs.subscribe(keys => {
            this.allKeys.set(keys);
            this.filterKeys();
            this.activeKeysCount.set(this.allKeys().filter(k => k.isActive).length);
        });

        this.loadTransactionStats();
    }

    loadTransactionStats(): void {
        this.paymentService.getRecentPayments().subscribe({
            next: (payments: Payment[]) => {
                if (!payments || payments.length === 0) return;

                const total = payments.length;
                const success = payments.filter(p => p.status === PaymentStatus.SUCCESS).length;
                const latencies = payments
                    .map(p => p.providerResponseTimeMs || (p as any).latency || 0)
                    .filter(l => l > 0);

                const avg = latencies.length > 0
                    ? latencies.reduce((a, b) => a + b, 0) / latencies.length
                    : 0;

                this.apiCallsCount.set(total);
                this.successRate.set(total > 0 ? Number((success / total * 100).toFixed(1)) : 0);
                this.avgLatency.set(Math.round(avg));
            },
            error: (err) => console.error('Error loading developer stats:', err)
        });
    }

    setEnvironment(env: 'sandbox' | 'live'): void {
        this.currentEnvironment = env;
        this.filterKeys();
    }

    toggleEnvironment(): void {
        this.currentEnvironment = this.currentEnvironment === 'sandbox' ? 'live' : 'sandbox';
        this.filterKeys();
    }

    filterKeys(): void {
        this.filteredKeys.set(this.allKeys().filter(k => k.environment === this.currentEnvironment));
    }

    generateNewKey(): void {
        const label = prompt('Entrez un nom pour cette clé :', `Clé ${this.currentEnvironment}`);
        if (label) {
            this.developerService.generateKey(label, this.currentEnvironment);
        }
    }

    revokeKey(id: string): void {
        if (this.isAdmin()) {
            this.developerService.adminToggleKeyStatus(id, false).subscribe(() => this.refreshKeys());
        } else {
            this.developerService.revokeKey(id);
        }
    }

    deleteKey(id: string): void {
        const confirmMsg = this.isAdmin()
            ? 'ADMIN: Confirmer la suppression DÉFINITIVE de cette clé ?'
            : 'Êtes-vous sûr de vouloir supprimer cette clé ? Cette action est irréversible.';

        if (confirm(confirmMsg)) {
            if (this.isAdmin()) {
                this.developerService.adminDeleteKey(id).subscribe(() => this.refreshKeys());
            } else {
                this.developerService.deleteKey(id);
            }
        }
    }

    activateKey(id: string): void {
        if (this.isAdmin()) {
            this.developerService.adminToggleKeyStatus(id, true).subscribe(() => this.refreshKeys());
        }
    }

    private refreshKeys(): void {
        const obs = this.isAdmin()
            ? this.developerService.getAllKeysAdmin()
            : this.developerService.getKeys();

        obs.subscribe(keys => {
            this.allKeys.set(keys);
            this.filterKeys();
            this.activeKeysCount.set(this.allKeys().filter(k => k.isActive).length);
        });
    }

    copyToClipboard(text: string): void {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copié dans le presse-papier !');
        });
    }
}
