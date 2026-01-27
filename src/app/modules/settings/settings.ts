import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './settings.html',
    styleUrls: ['./settings.scss']
})
export class SettingsComponent {
    // Dans une version réelle, on chargerait cette valeur depuis le backend
    // par ex: GET /api/config/webhook
    webhookUrl = signal('https://mon-site-marchand.com/api/payment-callback');

    updateWebhookUrl(event: Event) {
        const input = event.target as HTMLInputElement;
        this.webhookUrl.set(input.value);
    }

    saveSettings() {
        console.log('Sauvegarde de la configuration Webhook:', this.webhookUrl());
        // TODO: Appeler PaymentService.updateConfig(...) ou similaire
        alert('Configuration sauvegardée avec succès !');
    }

    testWebhook() {
        console.log('Test du webhook vers:', this.webhookUrl());
        // TODO: Appeler endpoint de test du backend
        alert('Requête de test envoyée !');
    }
}
