import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ADMIN_PAYMENT_PROVIDERS_API,
  DEVELOPER_PAYMENT_PROVIDERS_API,
  DEVELOPER_PROVIDER_ACCOUNTS_API,
  ADMIN_PAYMENT_ROUTES_API,
  ADMIN_PAYMENT_PROVIDER_ROUTES_API,
  DEVELOPER_PAYMENT_ROUTES_API
} from './api.config';

export interface Agregateur {
  id?: number;
  nomA: string;
  cleApblic: string;
  cleApr: string;
  cleAtoken: string;
  nompays: string;
  nomOperateur: string;
  countryConfigs?: CountryConfig[];
  ownerUserId?: string;
  enabled?: boolean;
  createdAt?: string;
  updatedAt?: string;
  providerId?: number;
  providerCode?: string;
  displayName?: string;
  credentialSchema?: string;
  environment?: string;
}

export interface CountryConfig {
  id?: number;
  countryName: string;
  operators: string;
  operatorDraft?: string;
}

export interface PaymentProvider {
  id: number;
  code: string;
  displayName: string;
  status: 'ACTIVE' | 'INACTIVE';
  credentialSchema?: string;
}

export interface MerchantProviderAccount {
  id: number;
  providerId: number;
  providerCode: string;
  providerDisplayName: string;
  environment: string;
  enabled: boolean;
  credentialHints: Record<string, string>;
}

export interface PaymentRouteSetting {
  routeId: number;
  providerId: number;
  providerCode: string;
  providerDisplayName: string;
  direction: 'PAYIN' | 'PAYOUT';
  country: string;
  operator: string;
  flowType: string;
  environment: string;
  providerChannel: string;
  priority: number;
  platformEnabled: boolean;
  observedUp: boolean;
  merchantEnabled?: boolean | null;
  effectiveEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class AgregateurService {
  private http = inject(HttpClient);

  getPaymentProviders(admin = false): Observable<PaymentProvider[]> {
    return this.http.get<PaymentProvider[]>(admin ? ADMIN_PAYMENT_PROVIDERS_API : DEVELOPER_PAYMENT_PROVIDERS_API);
  }

  createPaymentProvider(provider: Partial<PaymentProvider>): Observable<PaymentProvider> {
    return this.http.post<PaymentProvider>(ADMIN_PAYMENT_PROVIDERS_API, provider);
  }

  updatePaymentProvider(id: number, provider: Partial<PaymentProvider>): Observable<PaymentProvider> {
    return this.http.put<PaymentProvider>(`${ADMIN_PAYMENT_PROVIDERS_API}/${id}`, provider);
  }

  setPaymentProviderStatus(id: number, status: 'ACTIVE' | 'INACTIVE'): Observable<PaymentProvider> {
    return this.http.patch<PaymentProvider>(`${ADMIN_PAYMENT_PROVIDERS_API}/${id}/status`, { status });
  }

  deletePaymentProvider(id: number): Observable<void> {
    return this.http.delete<void>(`${ADMIN_PAYMENT_PROVIDERS_API}/${id}`);
  }

  getProviderAccounts(): Observable<MerchantProviderAccount[]> {
    return this.http.get<MerchantProviderAccount[]>(DEVELOPER_PROVIDER_ACCOUNTS_API);
  }

  upsertProviderAccount(payload: { providerId: number; environment: string; enabled: boolean; credentials: Record<string, string> }): Observable<MerchantProviderAccount> {
    return this.http.post<MerchantProviderAccount>(DEVELOPER_PROVIDER_ACCOUNTS_API, payload);
  }

  setProviderAccountEnabled(id: number, enabled: boolean): Observable<MerchantProviderAccount> {
    return this.http.patch<MerchantProviderAccount>(`${DEVELOPER_PROVIDER_ACCOUNTS_API}/${id}/status`, { enabled });
  }

  deleteProviderAccount(id: number): Observable<void> {
    return this.http.delete<void>(`${DEVELOPER_PROVIDER_ACCOUNTS_API}/${id}`);
  }

  createPaymentProviderRoute(payload: any): Observable<PaymentRouteSetting> {
    return this.http.post<PaymentRouteSetting>(ADMIN_PAYMENT_PROVIDER_ROUTES_API, payload);
  }

  getPaymentRoutes(admin = false): Observable<PaymentRouteSetting[]> {
    return this.http.get<PaymentRouteSetting[]>(admin ? ADMIN_PAYMENT_ROUTES_API : DEVELOPER_PAYMENT_ROUTES_API);
  }

  setPaymentRouteEnabled(routeId: number, enabled: boolean, admin = false): Observable<PaymentRouteSetting> {
    const baseUrl = admin ? ADMIN_PAYMENT_ROUTES_API : DEVELOPER_PAYMENT_ROUTES_API;
    return this.http.patch<PaymentRouteSetting>(`${baseUrl}/${routeId}/status`, { enabled });
  }
}
