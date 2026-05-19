import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { DEVELOPER_KEYS_API, ADMIN_DEVELOPERS_API } from './api.config';

export interface ApiKey {
    id: string;
    name: string;
    publicKey: string;
    secretKey?: string;
    secretKeyMasked: string;
    environment: 'sandbox' | 'live';
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

    constructor() {
        this.loadKeys();
    }

    private getHeaders() {
        return {};
    }

    private loadKeys() {
        this.http.get<ApiKey[]>(this.apiUrl, { headers: this.getHeaders() }).subscribe({
            next: (keys) => this.keysSubject.next(keys),
            error: (err) => {
                console.warn('Developer API keys not found or unauthorized', err);
                this.keysSubject.next([]);
            }
        });
    }

    getKeys(): Observable<ApiKey[]> {
        return this.keysSubject.asObservable();
    }

    createKey(name: string, environment: 'sandbox' | 'live'): Observable<ApiKey> {
        const request = { name, environment };
        return this.http.post<ApiKey>(this.apiUrl, request, { headers: this.getHeaders() });
    }

    generateKey(name: string, environment: 'sandbox' | 'live'): void {
        this.createKey(name, environment).subscribe({
            next: (newKey) => this.addKeyToState(newKey),
            error: (err) => console.error('Failed to generate key:', err)
        });
    }

    revokeKey(id: string): void {
        this.http.post(`${this.apiUrl}/${id}/revoke`, {}, { headers: this.getHeaders() }).subscribe({
            next: () => {
                const keys = this.keysSubject.getValue().map(k => {
                    if (k.id === id) return { ...k, isActive: false };
                    return k;
                });
                this.keysSubject.next(keys);
            },
            error: (err) => console.error('Failed to revoke key:', err)
        });
    }

    rotateKeys(): void {
        this.http.post<{ message: string, newKeys: ApiKey[] }>(`${this.apiUrl}/rotate`, {}, { headers: this.getHeaders() }).subscribe({
            next: (res) => {
                // When rotating, essentially all old keys become inactive and we get new ones
                this.loadKeys();
            },
            error: (err) => console.error('Failed to rotate keys:', err)
        });
    }

    deleteKey(id: string): void {
        this.revokeKey(id);
    }

    addKeyToState(newKey: ApiKey): void {
        const currentKeys = this.keysSubject.getValue();
        this.keysSubject.next([...currentKeys, newKey]);
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
        return this.http.get<WebhookEndpoint[]>(`${this.apiUrl.replace('/keys', '/webhooks')}`, {
            headers: this.getHeaders(),
            params
        });
    }

    createWebhook(request: CreateWebhookRequest): Observable<WebhookEndpoint> {
        return this.http.post<WebhookEndpoint>(`${this.apiUrl.replace('/keys', '/webhooks')}`, request, {
            headers: this.getHeaders()
        });
    }

    deleteWebhook(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl.replace('/keys', '/webhooks')}/${id}`, {
            headers: this.getHeaders()
        });
    }

    setWebhookActive(id: string, isActive: boolean): Observable<WebhookEndpoint> {
        return this.http.patch<WebhookEndpoint>(`${this.apiUrl.replace('/keys', '/webhooks')}/${id}`, { isActive }, {
            headers: this.getHeaders()
        });
    }
}
