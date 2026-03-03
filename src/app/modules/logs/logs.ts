import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoringService } from '../../core/services/monitoring.service';
import { LogEntry } from '../../core/models/log.model';

@Component({
    selector: 'app-logs',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './logs.html',
    styleUrls: ['./logs.scss']
})
export class LogsComponent implements OnInit {
    private monitoringService = inject(MonitoringService);
    logs = signal<LogEntry[]>([]);

    ngOnInit() {
        this.loadLogs();
    }

    loadLogs() {
        this.monitoringService.getLogs().subscribe({
            next: (data) => this.logs.set(data),
            error: (err) => console.error('Error loading logs:', err)
        });
    }
}
