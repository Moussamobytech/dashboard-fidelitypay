import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LogEntry } from '../models/log.model';
import { MONITORING_API } from './api.config';

@Injectable({
    providedIn: 'root'
})
export class MonitoringService {
    private http = inject(HttpClient);
    private apiUrl = MONITORING_API;

    /**
     * Récupérer les logs de monitoring
     * GET /api/monitoring/logs
     */
    getLogs(): Observable<LogEntry[]> {
        return this.http.get<LogEntry[]>(`${this.apiUrl}/logs`);
    }
}
