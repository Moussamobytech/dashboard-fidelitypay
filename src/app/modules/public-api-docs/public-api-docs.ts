import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-public-api-docs',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './public-api-docs.html',
  styleUrls: ['./public-api-docs.scss'],
})
export class PublicApiDocsComponent {
  copiedSection = signal<string | null>(null);
  copyError = signal<string | null>(null);
  readonly initiateCurl = `curl -X POST http://localhost:8060/api/v1/payments/initiate \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: VOTRE_CLE_API_FIDELITYPAY" \\
  -H "Idempotency-Key: VOTRE_REFERENCE_UNIQUE" \\
  -d '{
    "amount": 5000,
    "country": "SN",
    "operator": "WAVE",
    "customer": {
      "phone": "221776006060",
      "firstname": "Awa",
      "lastname": "Diop",
      "email": "awa@example.com"
    },
    "returnUrl": "https://merchant.example/success",
    "cancelUrl": "https://merchant.example/cancel"
  }'`;

  readonly statusCurl = `curl -X GET http://localhost:8060/api/v1/payments/VOTRE_PAYMENT_ID \\
  -H "X-API-Key: VOTRE_CLE_API_FIDELITYPAY"`;

  readonly otpCurl = `curl -X POST http://localhost:8060/api/v1/payments/VOTRE_PAYMENT_ID/actions/otp \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: VOTRE_CLE_API_FIDELITYPAY" \\
  -d '{ "otp": "123456" }'`;

  async copy(value: string, section: string): Promise<void> {
    this.copyError.set(null);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        this.copyWithFallback(value);
      }
      this.markCopied(section);
    } catch {
      try {
        this.copyWithFallback(value);
        this.markCopied(section);
      } catch {
        this.copyError.set(
          'La copie automatique a échoué. Sélectionnez le bloc de code et copiez-le manuellement.',
        );
      }
    }
  }

  private copyWithFallback(value: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (!copied) throw new Error('Copy command rejected');
  }

  private markCopied(section: string): void {
    this.copiedSection.set(section);
    window.setTimeout(() => {
      if (this.copiedSection() === section) this.copiedSection.set(null);
    }, 1800);
  }
}
