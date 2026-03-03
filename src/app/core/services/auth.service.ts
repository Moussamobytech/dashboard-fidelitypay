import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

export interface AuthResponse {
    token: string;
    userId: string;
    fullName: string;
    email: string;
    role: string;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface RegisterRequest {
    fullName: string;
    email: string;
    password: string;
    role?: string;
    countries?: string[];
    applicationName?: string;
}

export interface CurrentUser {
    userId: string;
    fullName: string;
    email: string;
    role: string;
    token: string;
}

const STORAGE_KEY = 'fidelitypay_auth';
const API_BASE = '/api/v1/auth';

@Injectable({
    providedIn: 'root'
})
export class AuthService {

    private _currentUser = signal<CurrentUser | null>(this.loadFromStorage());

    // Accès public aux signaux
    readonly currentUser = this._currentUser.asReadonly();

    readonly isAuthenticated = computed(() => this._currentUser() !== null);

    readonly userRole = computed(() => this._currentUser()?.role ?? null);
    readonly isAdmin = computed(() => this._currentUser()?.role === 'ADMIN');

    readonly userFullName = computed(() => this._currentUser()?.fullName ?? 'Utilisateur');

    readonly userInitials = computed(() => {
        const name = this._currentUser()?.fullName ?? '';
        return name
            .split(' ')
            .map(w => w[0] ?? '')
            .join('')
            .toUpperCase()
            .slice(0, 2) || 'U';
    });

    readonly roleLabel = computed(() => {
        const role = this._currentUser()?.role;
        switch (role) {
            case 'ADMIN': return 'Administrateur';
            case 'DEVELOPER': return 'Développeur';
            case 'ENTREPRENEUR_CEO': return 'Entrepreneur / CEO';
            case 'PRODUCT_MANAGER': return 'Product Manager';
            case 'AUTRE': return 'Client / Autre';
            default: return 'Utilisateur';
        }
    });

    constructor(private http: HttpClient, private router: Router) { }

    login(request: LoginRequest): Observable<AuthResponse> {
        return this.http.post<AuthResponse>(`${API_BASE}/login`, request).pipe(
            tap(response => this.saveSession(response)),
            catchError(err => {
                console.error('Erreur de connexion:', err);
                return throwError(() => err);
            })
        );
    }

    register(request: RegisterRequest, adminSecret?: string): Observable<AuthResponse> {
        const headers: Record<string, string> = {};
        if (adminSecret) {
            headers['X-ADMIN-SECRET'] = adminSecret;
        }
        return this.http.post<AuthResponse>(`${API_BASE}/register`, request, { headers }).pipe(
            tap(response => this.saveSession(response)),
            catchError(err => {
                console.error('Erreur d\'inscription:', err);
                return throwError(() => err);
            })
        );
    }

    logout(): void {
        localStorage.removeItem(STORAGE_KEY);
        this._currentUser.set(null);
        this.router.navigate(['/login']);
    }

    getToken(): string | null {
        return this._currentUser()?.token ?? null;
    }

    private saveSession(response: AuthResponse): void {
        const user: CurrentUser = {
            userId: response.userId,
            fullName: response.fullName,
            email: response.email,
            role: response.role,
            token: response.token,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        this._currentUser.set(user);
    }

    private loadFromStorage(): CurrentUser | null {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw) as CurrentUser;
        } catch {
            return null;
        }
    }
}
