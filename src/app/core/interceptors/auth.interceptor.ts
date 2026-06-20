import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const authService = inject(AuthService);
    const token = authService.getToken();

    // Do not add token for login/register routes
    if (req.url.includes('/api/v1/auth/')) {
        return next(req);
    }

    const authReq = token
        ? req.clone({
            setHeaders: {
                Authorization: `Bearer ${token}`
            }
        })
        : req;

    return next(authReq).pipe(
        catchError((error) => {
            if (token && error instanceof HttpErrorResponse && error.status === 401 && authService.isTokenExpired(token)) {
                authService.logout();
            }
            return throwError(() => error);
        })
    );
};
