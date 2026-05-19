import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ADMIN_AGREGATEURS_API, DEVELOPER_AGREGATEURS_API } from './api.config';

export interface Agregateur {
  id?: number;
  nomA: string;
  cleApblic: string;
  cleApr: string;
  cleAtoken: string;
  nompays: string;
  nomOperateur: string;
  ownerUserId?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AgregateurService {
  private http = inject(HttpClient);
  private adminUrl = ADMIN_AGREGATEURS_API;
  private developerUrl = DEVELOPER_AGREGATEURS_API;

  getAllAgregateurs(admin = false): Observable<Agregateur[]> {
    return this.http.get<Agregateur[]>(admin ? this.adminUrl : this.developerUrl);
  }

  getAgregateurById(id: number): Observable<Agregateur> {
    return this.http.get<Agregateur>(`${this.adminUrl}/${id}`);
  }

  createAgregateur(agregateur: Agregateur, admin = false): Observable<Agregateur> {
    return this.http.post<Agregateur>(admin ? this.adminUrl : this.developerUrl, agregateur);
  }

  updateAgregateur(id: number, agregateur: Agregateur, admin = false): Observable<Agregateur> {
    const baseUrl = admin ? this.adminUrl : this.developerUrl;
    return this.http.put<Agregateur>(`${baseUrl}/${id}`, agregateur);
  }

  deleteAgregateur(id: number, admin = false): Observable<any> {
    const baseUrl = admin ? this.adminUrl : this.developerUrl;
    return this.http.delete(`${baseUrl}/${id}`);
  }

  setAgregateurEnabled(id: number, enabled: boolean, admin = false): Observable<Agregateur> {
    const baseUrl = admin ? this.adminUrl : this.developerUrl;
    return this.http.patch<Agregateur>(`${baseUrl}/${id}/status`, { enabled });
  }
}
