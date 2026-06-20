import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { DEVELOPER_KEYS_API, DEVELOPER_WEBHOOKS_API, ADMIN_DEVELOPERS_API } from './api.config';

export interface ApiKey {
    id: string;
    name: string;
    apiKey?: string;
    apiKeyMasked: string;
    isActive: boolean;
    createdAt: string;
    lastUsedAt?: string;
    lastUsedIp?: string;
    expiresAt?: string;
    userFullName?: string;
    userEmail?: string;
}

export interface WebhookEndpoint {
    id: string;
    url: string;
    event: string;
    description?: string;
    secret?: string;
    isActive: boolean;
    lastTriggeredAt?: string;
    lastStatusCode?: number;
    failureCount: number;
    createdAt: string;
}

export interface CreateWebhookRequest {
    url: string;
    event: string;
    description?: string;
}

@Injectable({
    providedIn: 'root'
})
export class DeveloperService {
    private http = inject(HttpClient);
    private apiUrl = DEVELOPER_KEYS_API;
    private adminUrl = ADMIN_DEVELOPERS_API;

    private keysSubject = new BehaviorSubject<ApiKey[]>([]);
    private keysLoaded = false;

    constructor() { }

    private getHeaders() {
        return {};
    }

    private loadKeys() {
        this.keysLoaded = true;
        this.http.get<ApiKey[]>(this.apiUrl, { headers: this.getHeaders() }).subscribe({
            next: (keys) => this.keysSubject.next(keys.filter(key => key.isActive)),
            error: (err) => {
                console.warn('Developer API keys not found or unauthorized', err);
                this.keysSubject.next([]);
            }
        });
    }

    getKeys(): Observable<ApiKey[]> {
        if (!this.keysLoaded) {
            this.loadKeys();
        }
        return this.keysSubject.asObservable();
    }

    createKey(name: string): Observable<ApiKey> {
        const request = { name };
        return this.http.post<ApiKey>(this.apiUrl, request, { headers: this.getHeaders() });
    }

    renameKey(id: string, name: string): Observable<ApiKey> {
        return this.http.patch<ApiKey>(`${this.apiUrl}/${id}`, { name }, { headers: this.getHeaders() }).pipe(
            tap((updatedKey) => {
                const keys = this.keysSubject.getValue().map(key => key.id === id ? updatedKey : key);
                this.keysSubject.next(keys.filter(key => key.isActive));
            })
        );
    }

    deleteKey(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/${id}`, { headers: this.getHeaders() }).pipe(
            tap(() => {
                const keys = this.keysSubject.getValue().filter(key => key.id !== id);
                this.keysSubject.next(keys);
            })
        );
    }

    addKeyToState(newKey: ApiKey): void {
        const currentKeys = this.keysSubject.getValue();
        const nextKeys = currentKeys.some(key => key.id === newKey.id)
            ? currentKeys.map(key => key.id === newKey.id ? newKey : key)
            : [...currentKeys, newKey];
        this.keysSubject.next(nextKeys.filter(key => key.isActive));
    }

    // =========================================================================
    // ADMIN METHODS
    // =========================================================================

    getAllKeysAdmin(): Observable<ApiKey[]> {
        return this.http.get<ApiKey[]>(`${this.adminUrl}/keys`);
    }

    adminToggleKeyStatus(id: string, active: boolean): Observable<any> {
        return this.http.patch(`${this.adminUrl}/keys/${id}/status`, { active });
    }

    adminDeleteKey(id: string): Observable<any> {
        return this.http.delete(`${this.adminUrl}/keys/${id}`);
    }

    getWebhooks(event?: string): Observable<WebhookEndpoint[]> {
        const params = event ? { event } : undefined;
        return this.http.get<WebhookEndpoint[]>(DEVELOPER_WEBHOOKS_API, {
            headers: this.getHeaders(),
            params
        });
    }

    createWebhook(request: CreateWebhookRequest): Observable<WebhookEndpoint> {
        return this.http.post<WebhookEndpoint>(DEVELOPER_WEBHOOKS_API, request, {
            headers: this.getHeaders()
        });
    }

    deleteWebhook(id: string): Observable<any> {
        return this.http.delete(`${DEVELOPER_WEBHOOKS_API}/${id}`, {
            headers: this.getHeaders()
        });
    }

    setWebhookActive(id: string, isActive: boolean): Observable<WebhookEndpoint> {
        return this.http.patch<WebhookEndpoint>(`${DEVELOPER_WEBHOOKS_API}/${id}`, { isActive }, {
            headers: this.getHeaders()
        });
    }
}
