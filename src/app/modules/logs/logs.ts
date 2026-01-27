import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-logs',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './logs.html',
    styleUrls: ['./logs.scss']
})
export class LogsComponent {
    logs = [
        { timestamp: '2024-03-12 10:45:22', level: 'INFO', context: 'ROUTE_SELECTION', message: 'Selected primary route Orange SN for TXN-789. Reason: Cost Optimization', details: 'Cost: 1% | Latency: 1.1s' },
        { timestamp: '2024-03-12 10:45:25', level: 'ERROR', context: 'PAYMENT_INITIATE', message: 'Moov BJ returned 503 Service Unavailable', details: 'Switching to fallback Wave SN' },
        { timestamp: '2024-03-12 10:45:28', level: 'SUCCESS', context: 'FALLBACK_TRIGGER', message: 'Transaction completed via fallback Wave SN', details: 'TXN-789 successfully processed' },
        { timestamp: '2024-03-12 10:46:01', level: 'INFO', context: 'HEALTH_CHECK', message: 'All routes UP except Moov BJ', details: 'Re-checking in 60s' },
    ];
}
