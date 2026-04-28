import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Payment, PaymentInitiateRequest, PaymentResponseDTO } from '../models/payment.model';
import { PAYMENT_API } from './api.config';

@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    private http = inject(HttpClient);
    private apiUrl = PAYMENT_API; // Base API URL

    /**
     * Liste des moyens de paiement disponibles par pays
     * GET /api/payment-options?country=...
     */
    getPaymentOptions(country: string): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/payment-options`, {
            params: { country }
        });
    }

    /**
     * Initialisation d’un paiement
     * POST /api/payments/initiate
     */
    initiatePayment(request: PaymentInitiateRequest): Observable<PaymentResponseDTO> {
        return this.http.post<PaymentResponseDTO>(`${this.apiUrl}/payments/initiate`, request);
    }

    /**
     * Statut d’un paiement
     * GET /api/payments/status/{paymentId}
     */
    getPaymentStatus(paymentId: string): Observable<Payment> {
        return this.http.get<Payment>(`${this.apiUrl}/payments/status/${paymentId}`);
    }

    /**
     * Récupérer les paiements récents
     * GET /api/payments
     */
    getRecentPayments(): Observable<Payment[]> {
        return this.http.get<Payment[]>(`${this.apiUrl}/payments`);
    }

    /**
     * Liste des pays ayant des transactions
     * GET /api/payments/countries
     */
    getPaymentCountries(): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/payments/countries`);
    }

    getPaymentsByUser(userId: string): Observable<Payment[]> {
        return this.http.get<Payment[]>(`${this.apiUrl}/payments`, {
            params: { userId }
        }).pipe(
            map((payments: any[]) => {
                // Le backend filtre maintenant par userId si passé (pour Admin)
                // ou par user context (pour Developer). On ne fait plus de filtre manuel ici.
                return (payments || []).map(d => {
                    const data = d.payment ? d.payment : d;
                    return {
                        ...data,
                        // Correction mapping latence (different fields according to backend version)
                        routeLatency: data.latence ?? data.providerResponseTimeMs ?? d.routeLatency ?? data.latency ?? 0
                    } as Payment;
                });
            })
        );
    }
}
