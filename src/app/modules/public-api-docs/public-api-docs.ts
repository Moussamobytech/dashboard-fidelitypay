import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-public-api-docs',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './public-api-docs.html',
    styleUrls: ['./public-api-docs.scss']
})
export class PublicApiDocsComponent {
    readonly initiateCurl = `curl -X POST http://localhost:8060/api/v1/payments/initiate \\
  -H "Content-Type: application/json" \\
  -H "X-API-Public-Key: pk_live_xxx" \\
  -H "X-API-Secret-Key: sk_live_xxx" \\
  -H "Idempotency-Key: order-1001" \\
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

    readonly statusCurl = `curl -X GET http://localhost:8060/api/v1/payments/fp_xxx \\
  -H "X-API-Public-Key: pk_live_xxx" \\
  -H "X-API-Secret-Key: sk_live_xxx"`;

    readonly otpCurl = `curl -X POST http://localhost:8060/api/v1/payments/fp_xxx/actions/otp \\
  -H "Content-Type: application/json" \\
  -H "X-API-Public-Key: pk_live_xxx" \\
  -H "X-API-Secret-Key: sk_live_xxx" \\
  -d '{ "otp": "123456" }'`;

    copy(value: string): void {
        navigator.clipboard.writeText(value);
    }
}
