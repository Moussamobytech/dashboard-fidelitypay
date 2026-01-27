import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-routing-config',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './routing.html',
    styleUrls: ['./routing.scss']
})
export class RoutingConfigComponent {
    routingRules = [
        { country: 'Sénégal', operator: 'Orange Money', priority: 1, strategy: 'Coût minimum', status: 'Actif', fallback: 'Wave' },
        { country: 'Sénégal', operator: 'Wave', priority: 2, strategy: 'Latence minimum', status: 'Actif', fallback: 'PayDunya' },
        { country: 'Bénin', operator: 'Moov', priority: 1, strategy: 'Taux de succès', status: 'Alerte', fallback: 'Kkiapay' },
    ];

    performanceData = [
        { route: 'Primary (Local API)', cost: '0.5%', latency: '0.8s', success: '99.5%' },
        { route: 'Aggregator (SamirPay)', cost: '2.0%', latency: '1.4s', success: '98.0%' },
        { route: 'Fallback (Backup Link)', cost: '1.5%', latency: '2.1s', success: '96.5%' },
    ];
}
