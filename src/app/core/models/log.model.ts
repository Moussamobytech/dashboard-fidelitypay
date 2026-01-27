import { ErrorType } from './route.model';

export enum LogStatus {
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED'
}

export interface LogEntry {
    id?: number;
    paymentId: string;
    routeUsed: string;
    responseTime: number;
    status: LogStatus;
    failureReason?: string;
    errorType?: ErrorType;
    message?: string;
    timestamp?: string;
}
