import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ADMIN_AGREGATEURS_API } from './api.config';

export interface CountryConfig {
  id?: number;
  countryName: string;
  operators: string;
}

export interface Agregateur {
  id?: number;
  nomA: string;
  cleApblic: string;
  cleApr: string;
  cleAmaster?: string;
  cleAtoken: string;
  baseUrl?: string;
  nompays?: string;
  nomOperateur?: string;
  countryConfigs: CountryConfig[];
}

@Injectable({
  providedIn: 'root'
})
export class AgregateurService {
  private http = inject(HttpClient);
  private apiUrl = ADMIN_AGREGATEURS_API;

  getAllAgregateurs(): Observable<Agregateur[]> {
    return this.http.get<Agregateur[]>(this.apiUrl);
  }

  getAgregateurById(id: number): Observable<Agregateur> {
    return this.http.get<Agregateur>(`${this.apiUrl}/${id}`);
  }

  createAgregateur(agregateur: Agregateur): Observable<Agregateur> {
    return this.http.post<Agregateur>(this.apiUrl, agregateur);
  }

  updateAgregateur(id: number, agregateur: Agregateur): Observable<Agregateur> {
    return this.http.put<Agregateur>(`${this.apiUrl}/${id}`, agregateur);
  }

  deleteAgregateur(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}
