import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
    id: string;
    email: string;
    fullName: string;
    role: string;
    applicationName?: string;
    countries?: string[];
    callbackUrl?: string;
    redirectUrl?: string;
    createdAt: string;
    isActive: boolean;
}

export interface UserUpdateRequest {
    fullName?: string;
    email?: string;
    role?: string;
    applicationName?: string;
    countries?: string[];
    callbackUrl?: string;
    redirectUrl?: string;
    isActive?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class UserService {
    private http = inject(HttpClient);
    private apiUrl = '/api/v1/admin/users';

    getAllUsers(): Observable<User[]> {
        return this.http.get<User[]>(this.apiUrl);
    }

    updateUser(id: string, request: UserUpdateRequest): Observable<User> {
        return this.http.put<User>(`${this.apiUrl}/${id}`, request);
    }

    deleteUser(id: string): Observable<any> {
        return this.http.delete(`${this.apiUrl}/${id}`);
    }
}
