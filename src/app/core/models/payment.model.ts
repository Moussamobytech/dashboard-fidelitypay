import { ErrorType } from './route.model';

export enum PaymentStatus {
    PENDING = 'PENDING',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED'
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

