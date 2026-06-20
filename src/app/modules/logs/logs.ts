import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MonitoringService } from '../../core/services/monitoring.service';
import { LogEntry } from '../../core/models/log.model';
import { FpSelectComponent, FpSelectOption, FpSelectValue } from '../../shared/fp-select/fp-select';

@Component({
    selector: 'app-logs',
    standalone: true,
    imports: [CommonModule, FpSelectComponent],
    templateUrl: './logs.html',
    styleUrls: ['./logs.scss']
})
export class LogsComponent implements OnInit {
    private monitoringService = inject(MonitoringService);
    logs = signal<LogEntry[]>([]);
    searchTerm = signal('');
    level = signal('');
    levelOptions: FpSelectOption[] = [
        { value: '', label: 'Tous les résultats' }, { value: 'SUCCESS', label: 'Succès' },
        { value: 'FAILED', label: 'Échec' }
    ];
    filteredLogs = computed(() => {
        const term = this.searchTerm().trim().toLowerCase();
        return this.logs().filter(log => {
            const matchesLevel = !this.level() || String(log.status).toUpperCase() === this.level();
            const matchesSearch = !term || [log.message, log.paymentId, log.routeUsed]
                .some(value => String(value || '').toLowerCase().includes(term));
            return matchesLevel && matchesSearch;
        });
    });

    ngOnInit() {
        this.loadLogs();
    }

    loadLogs() {
        this.monitoringService.getLogs().subscribe({
            next: (data) => this.logs.set(data),
            error: (err) => console.error('Error loading logs:', err)
        });
    }

    setSearch(event: Event): void {
        this.searchTerm.set((event.target as HTMLInputElement).value);
    }

    setLevel(value: FpSelectValue): void {
        this.level.set(String(value));
    }
}
