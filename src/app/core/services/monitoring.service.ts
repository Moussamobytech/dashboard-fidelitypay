import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Route } from '../models/route.model';
import { LogEntry } from '../models/log.model';

@Injectable({
    providedIn: 'root'
})
export class MonitoringService {
    private http = inject(HttpClient);
    private apiUrl = '/api/monitoring';

    getRoutes(): Observable<Route[]> {
        return this.http.get<Route[]>(`${this.apiUrl}/routes`);
    }

    /**
     * Déclencher un check manuel
     * POST /api/monitoring/check
     */
    checkRoutes(): Observable<Route[]> {
        return this.http.post<Route[]>(`${this.apiUrl}/check`, {});
    }

    /**
     * Récupérer les logs de monitoring
     * GET /api/monitoring/logs
     */
    getLogs(): Observable<LogEntry[]> {
        return this.http.get<LogEntry[]>(`${this.apiUrl}/logs`);
    }

    /**
     * Activer/Désactiver une route
     */
    toggleRoute(routeId: number, status: boolean): Observable<Route> {
        return this.http.post<Route>(`${this.apiUrl}/routes/toggle`, { id: routeId, enabled: status });
    }

    /**
     * Activer/Désactiver les alertes mail pour une route
     */
    toggleAlerts(routeId: number, status: boolean): Observable<any> {
        return this.http.post(`${this.apiUrl}/routes/alerts`, { id: routeId, enabled: status });
    }
}

