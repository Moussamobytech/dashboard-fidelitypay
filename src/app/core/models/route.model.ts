export enum ErrorType {
    NETWORK = 'NETWORK',
    TIMEOUT = 'TIMEOUT',
    AUTHENTICATION = 'AUTHENTICATION',
    PROVIDER_DOWN = 'PROVIDER_DOWN',
    BAD_REQUEST = 'BAD_REQUEST',
    INTERNAL_ERROR = 'INTERNAL_ERROR',
    INVALID_PARAMETERS = 'INVALID_PARAMETERS',
    BALANCE_INSUFFICIENT = 'BALANCE_INSUFFICIENT',
    LIMIT_EXCEEDED = 'LIMIT_EXCEEDED',
    UNKNOWN = 'UNKNOWN'
}

export interface Route {
    id?: number;
    name: string; // e.g., "Orange Money SN"
    provider: string; // e.g., "KKIAPAY", "PAYDUNYA"
    operator: string; // e.g., "ORANGE", "MTN"
    country?: string; // e.g., "SN", "CI"
    availability: boolean;
    avgLatency: number; // in milliseconds
    cost: number; // e.g. 0.0 or 0.5
    failureRate: number; // e.g. 0.1 for 10%
    priority: number; // Lower is better
    successRate?: string; // e.g. "90%"
    lastErrorMessage?: string;
    lastErrorType?: ErrorType;
    updatedAt?: string;
    countryName?: string;
    fallbackRate?: number; // e.g. 0.05 for 5%
    alertsEnabled?: boolean;
}
