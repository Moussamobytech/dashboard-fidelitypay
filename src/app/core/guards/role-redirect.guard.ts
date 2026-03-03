import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard that redirects the user to the correct dashboard based on their role
 * when they access the root path ('').
 */
export const roleRedirectGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated()) {
        router.navigate(['/login']);
        return false;
    }

    const role = authService.userRole();

    if (role === 'DEVELOPER') {
        router.navigate(['/developer-dashboard']);
    } else if (role === 'ADMIN') {
        router.navigate(['/dashboard']);
    } else {
        // Default fallback
        router.navigate(['/dashboard']);
    }

    return false; // Prevent navigation to the original path ('') as we are redirecting
};
