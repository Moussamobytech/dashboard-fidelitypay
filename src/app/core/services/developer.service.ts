import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { AuthService } from './auth.service';

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
    metadata?: any;
    userFullName?: string;
    userEmail?: string;
}

@Injectable({
    providedIn: 'root'
})
export class DeveloperService {
    private http = inject(HttpClient);
    private authService = inject(AuthService);
    private apiUrl = 'http://localhost:/api/v1/developer/keys';
    private adminUrl = 'http://localhost:8060/api/v1/admin/developers';

    private keysSubject = new BehaviorSubject<ApiKey[]>([]);

    constructor() {
        this.loadKeys();
    }

    private getHeaders(userId?: string) {
        const id = userId || this.authService.currentUser()?.userId || 'demo-user';
        return { 'X-User-Id': id };
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

    generateKey(name: string, userId: string, environment: 'sandbox' | 'live'): void {
        const request = { name, environment, metadata: 'Created via Dashboard' };
        this.http.post<ApiKey>(this.apiUrl, request, { headers: this.getHeaders(userId) }).subscribe({
            next: (newKey) => {
                const currentKeys = this.keysSubject.getValue();
                this.keysSubject.next([...currentKeys, newKey]);
            },
            error: (err) => {
                console.error('Failed to generate key:', err);
            }
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
}
