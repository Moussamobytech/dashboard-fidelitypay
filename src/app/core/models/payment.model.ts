import { ErrorType } from './route.model';

export enum PaymentStatus {
    PENDING = 'PENDING',
    REQUIRES_ACTION = 'REQUIRES_ACTION',
    PENDING_RECONCILIATION = 'PENDING_RECONCILIATION',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

export interface Payment {
    paymentId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    country: string;
    operator: string;
    cost: number;
    provider?: string;
    routeName?: string;
    routeHealth?: string; // HEALTHY, DEGRADED, DOWN, STABLE
    providerPaymentId?: string;
    providerResponse?: string;
    paymentUrl?: string;
    providerResponseTimeMs?: number;
    createdAt?: string; // ISO date string
    updatedAt?: string; // ISO date string
    errorType?: ErrorType;
    failureReason?: string;
    usedFallback?: boolean;
    countryName?: string; // Human readable country name
    userId?: string;     // ID of the user who owns the payment
    appName?: string;    // Nom de l'application qui a initié le paiement
}

export interface PaymentInitiateRequest {
    amount: number;
    country: string;
    operator: string;
    phone: string;
}

export interface PaymentResponseDTO {
    payment: Payment;
    routeAvailable: boolean;
    routeName: string;
    routeProvider: string;
    routeLatency: number;
}
