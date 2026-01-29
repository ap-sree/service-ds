import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './services/auth';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.currentUser()) {
        return true;
    }

    // Not logged in, redirect to login
    router.navigate(['/login']);
    return false;
};

export const adminGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);


    // Must be logged in AND have ADMIN role
    if (authService.currentUser() && authService.isAdmin()) {
        return true;
    }

    // If logged in but not admin, prevent access (stay on dashboard or go there)
    if (authService.currentUser()) {
        return false; // Or redirect
    }

    return authGuard(route, state);
};
