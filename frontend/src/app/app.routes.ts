import { Routes } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard';
import { AdminComponent } from './components/admin/admin';
import { LoginComponent } from './components/login/login';
import { authGuard, adminGuard } from './auth.guard';
export const routes: Routes = [
    { path: 'logout', component: LoginComponent },
    { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
    {
        path: 'form-builder',
        loadComponent: () => import('./components/form-builder/form-builder').then(m => m.FormBuilderComponent),
        canActivate: [authGuard]
    },
    {
        path: 'policy-visualizer',
        loadComponent: () => import('./components/policy-visualizer/policy-dashboard').then(m => m.PolicyDashboardComponent),
        canActivate: [authGuard]
    },
    {
        path: 'policy-comparison',
        loadComponent: () => import('./components/policy-comparison/policy-comparison').then(m => m.PolicyComparisonComponent),
        canActivate: [authGuard]
    },
    {
        path: 'automation',
        loadComponent: () => import('./components/automation/automation-list/automation-list').then(m => m.AutomationListComponent),
        canActivate: [authGuard]
    },
    {
        path: 'k8s',
        loadComponent: () => import('./components/k8s/k8s-dashboard').then(m => m.K8sDashboardComponent),
        canActivate: [authGuard]
    },
    {
        path: 'nlp',
        loadComponent: () => import('./components/nlp/nlp').then(m => m.NLPComponent),
        canActivate: [authGuard]
    },
    {
        path: 'admin',
        component: AdminComponent,
        canActivate: [authGuard, adminGuard],
        children: [
            {
                path: 'data-sources',
                loadComponent: () => import('./components/admin/components/data-source-config/data-source-config').then(m => m.DataSourceConfigComponent)
            },
            {
                path: 'sync-jobs',
                loadComponent: () => import('./components/admin/components/sync-job-config/sync-job-config').then(m => m.SyncJobConfigComponent)
            },
            {
                path: 'widgets',
                loadComponent: () => import('./components/admin/components/widget-builder/widget-builder').then(m => m.WidgetBuilderComponent)
            },
            {
                path: 'notifications',
                loadComponent: () => import('./components/admin/components/notification-rules/notification-rules').then(m => m.NotificationRulesComponent)
            },
            {
                path: 'users',
                loadComponent: () => import('./components/admin/components/user-directory/user-directory').then(m => m.UserDirectoryComponent)
            },
            {
                path: 'certificates',
                loadComponent: () => import('./components/admin/components/certificate-mgmt/certificate-mgmt').then(m => m.CertificateMgmtComponent)
            }
        ]
    },
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' }
];
