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

    /**
     * Récupérer les routes
     * GET /api/monitoring/routes
     */
    getRoutes(): Observable<Route[]> {
        return this.http.get<Route[]>(`${this.apiUrl}/routes`);
    }
    /**
       * Liste des pays ayant des transactions
       * GET /api/payments/countries
       */
    getPaymentCountries(): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/payments/countries`);
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
        return this.http.patch<Route>(`${this.apiUrl}/routes/${routeId}/toggle`, { status });
    }
}

