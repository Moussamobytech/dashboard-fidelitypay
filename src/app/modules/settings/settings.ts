import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of, switchMap } from 'rxjs';
import { DeveloperService, WebhookEndpoint } from '../../core/services/developer.service';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './settings.html',
    styleUrls: ['./settings.scss']
})
export class SettingsComponent implements OnInit {
    private developerService = inject(DeveloperService);
    private paymentEvents = ['payment.success', 'payment.failed', 'payment.cancelled', 'payment.requires_action'];

    webhookUrl = signal('https://mon-site-marchand.com/webhooks/fidelity-pay');
    providerCallbackInfo = '/api/payments/callback/kkiapay et /api/payments/callback/paydunya';
    statusMessage = signal('');
    isSaving = signal(false);
    private existingPaymentWebhooks: WebhookEndpoint[] = [];

    ngOnInit(): void {
        this.developerService.getWebhooks().subscribe({
            next: (webhooks) => {
                this.existingPaymentWebhooks = webhooks.filter(w => this.paymentEvents.includes(w.event));
                const active = this.existingPaymentWebhooks.find(w => w.isActive);
                if (active) {
                    this.webhookUrl.set(active.url);
                }
            },
            error: () => this.statusMessage.set('Impossible de charger les webhooks pour le moment.')
        });
    }

    updateWebhookUrl(event: Event) {
        const input = event.target as HTMLInputElement;
        this.webhookUrl.set(input.value);
    }

    saveSettings() {
        const url = this.webhookUrl().trim();
        if (!url.startsWith('https://')) {
            this.statusMessage.set('Utilisez une URL HTTPS publique pour les webhooks marchands.');
            return;
        }

        this.isSaving.set(true);
        const outdated = this.existingPaymentWebhooks.filter(w => w.url !== url);
        const existingForUrl = this.existingPaymentWebhooks.filter(w => w.url === url);
        const missingEvents = this.paymentEvents.filter(event => !existingForUrl.some(w => w.event === event));

        const deleteCalls = outdated.map(w => this.developerService.deleteWebhook(w.id));
        const deletePhase = deleteCalls.length ? forkJoin(deleteCalls) : of([]);

        deletePhase.pipe(
            switchMap(() => {
                const createCalls = missingEvents.map(event => this.developerService.createWebhook({
                    url,
                    event,
                    description: `Notification ${event}`
                }));
                const activateCalls = existingForUrl
                    .filter(w => !w.isActive)
                    .map(w => this.developerService.setWebhookActive(w.id, true));
                const calls = [...createCalls, ...activateCalls];
                return calls.length ? forkJoin(calls) : of([]);
            }),
            switchMap(() => this.developerService.getWebhooks())
        ).subscribe({
            next: (webhooks) => {
                this.existingPaymentWebhooks = webhooks.filter(w => this.paymentEvents.includes(w.event));
                this.statusMessage.set('Webhook marchand enregistré pour les événements de paiement.');
                this.isSaving.set(false);
            },
            error: () => {
                this.statusMessage.set('Échec de la sauvegarde du webhook.');
                this.isSaving.set(false);
            }
        });
    }
}
