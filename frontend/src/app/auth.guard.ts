import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from './auth/auth';
import { environment } from '../environments/environment';

export const authGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAuthenticated) {
        authService.login();
        return false;
    }

    const pathSegment = state.url.split('/').pop() || route.routeConfig?.path;
    
    if (!isRouteEnabled(pathSegment)) {
        router.navigate([checkAndGetRoute()]);
        return false;
    }

    return true;
};

export const adminGuard: CanActivateFn = (route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (!authService.isAdmin()) {
        router.navigate([checkAndGetRoute()]);
        return false;
    }

    const pathSegment = state.url.split('/').pop() || route.routeConfig?.path;

    if (!isRouteEnabled(pathSegment)) {
        router.navigate([checkAndGetRoute()]);
        return false;
    }

    return true;
};

export const isRouteEnabled = (path: string | undefined): boolean => {
    switch (path) {
        case 'dashboard': return environment.menus.dashboard;
        case 'form-builder': return environment.menus.formBuilder;
        case 'automation': return environment.menus.automation;
        case 'k8s': return environment.menus.kubernetes;
        case 'policy-visualizer': return environment.menus.policyVisualizer;
        case 'policy-comparison': return environment.menus.policyComparison;
        case 'nlp': return environment.menus.naturalLanguage;
        case 'data-sources': return environment.menus.administration.dataSources;
        case 'sync-jobs': return environment.menus.administration.syncJobs;
        case 'widgets': return environment.menus.administration.widgets;
        case 'notifications': return environment.menus.administration.notificationRules;
        case 'users': return environment.menus.administration.users;
        case 'certificates': return environment.menus.administration.certificates;
        default: return true;
    }
};

export const checkAndGetRoute = (): string => {
    if (environment.menus.dashboard) return '/dashboard';
    if (environment.menus.formBuilder) return '/form-builder';
    if (environment.menus.automation) return '/automation';
    if (environment.menus.kubernetes) return '/k8s';
    if (environment.menus.policyVisualizer) return '/policy-visualizer';
    if (environment.menus.policyComparison) return '/policy-comparison';
    if (environment.menus.naturalLanguage) return '/nlp';

    if (environment.menus.administration.dataSources) return '/admin/data-sources';
    if (environment.menus.administration.syncJobs) return '/admin/sync-jobs';
    if (environment.menus.administration.widgets) return '/admin/widgets';
    if (environment.menus.administration.notificationRules) return '/admin/notifications';
    if (environment.menus.administration.users) return '/admin/users';
    if (environment.menus.administration.certificates) return '/admin/certificates';

    return '/logout';
};


