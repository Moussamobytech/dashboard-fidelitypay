import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Payment, PaymentInitiateRequest, PaymentResponseDTO } from '../models/payment.model';

@Injectable({
    providedIn: 'root'
})
export class PaymentService {
    private http = inject(HttpClient);
    private apiUrl = '/api'; // Base API URL

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
}

