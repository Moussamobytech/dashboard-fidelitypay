import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout';
import { DashboardOverviewComponent } from './modules/dashboard/overview/overview';
import { RoutingConfigComponent } from './modules/routing/routing';
import { LogsComponent } from './modules/logs/logs';
import { roleRedirectGuard } from './core/guards/role-redirect.guard';
import { authGuard } from './core/guards/auth.guard';

const MERCHANT_ROLES = ['DEVELOPER', 'ENTREPRENEUR_CEO', 'PRODUCT_MANAGER', 'AUTRE'];

export const routes: Routes = [
    {
        path: 'login',
        loadComponent: () => import('./modules/auth/login').then(m => m.LoginComponent)
    },
    {
        path: 'register',
        loadComponent: () => import('./modules/auth/register').then(m => m.RegisterComponent)
    },
    {
        path: 'forgot-password',
        loadComponent: () => import('./modules/auth/forgot-password').then(m => m.ForgotPasswordComponent)
    },
    {
        path: 'api-docs',
        loadComponent: () => import('./modules/public-api-docs/public-api-docs').then(m => m.PublicApiDocsComponent)
    },
    {
        path: '',
        component: MainLayoutComponent,
        canActivate: [authGuard],
        children: [
            { path: '', canActivate: [roleRedirectGuard], component: MainLayoutComponent },
            { path: 'dashboard', canActivate: [authGuard], data: { roles: ['ADMIN'] }, component: DashboardOverviewComponent },
            { path: 'routing', canActivate: [authGuard], data: { roles: ['ADMIN', ...MERCHANT_ROLES] }, component: RoutingConfigComponent },
            { path: 'logs', canActivate: [authGuard], data: { roles: ['ADMIN'] }, component: LogsComponent },
            {
                path: 'transactions',
                canActivate: [authGuard],
                data: { roles: ['ADMIN'] },
                loadComponent: () => import('./modules/transactions/transactions.component').then(m => m.TransactionsComponent)
            },
            {
                path: 'analytics',
                canActivate: [authGuard],
                data: { roles: ['ADMIN', ...MERCHANT_ROLES] },
                loadComponent: () => import('./modules/analytics/analytics').then(m => m.AnalyticsComponent)
            },
            {
                path: 'developers/providers/:providerId/routes',
                canActivate: [authGuard],
                data: { roles: MERCHANT_ROLES },
                loadComponent: () => import('./modules/developers/provider-routes/provider-routes').then(m => m.ProviderRoutesComponent)
            },
            {
                path: 'developers',
                canActivate: [authGuard],
                data: { roles: ['ADMIN', ...MERCHANT_ROLES] },
                loadComponent: () => import('./modules/developers/developers').then(m => m.DevelopersComponent)
            },
            {
                path: 'api-keys',
                canActivate: [authGuard],
                data: { roles: ['ADMIN', ...MERCHANT_ROLES] },
                loadComponent: () => import('./modules/developers/api-keys/api-keys').then(m => m.ApiKeysComponent)
            },
            {
                path: 'developer-dashboard',
                canActivate: [authGuard],
                data: { roles: MERCHANT_ROLES },
                loadComponent: () => import('./modules/developers/dashboard/developer-dashboard').then(m => m.DeveloperDashboardComponent)
            },
            {
                path: 'developer-transactions',
                canActivate: [authGuard],
                data: { roles: MERCHANT_ROLES },
                loadComponent: () => import('./modules/developers/transactions/developer-transactions').then(m => m.DeveloperTransactionsComponent)
            },
            {
                path: 'payment-test',
                canActivate: [authGuard],
                data: { roles: MERCHANT_ROLES },
                loadComponent: () => import('./modules/developers/payment-tester/payment-tester').then(m => m.PaymentTesterComponent)
            },
            {
                path: 'users',
                canActivate: [authGuard],
                data: { roles: ['ADMIN'] },
                loadComponent: () => import('./modules/users/users').then(m => m.UsersComponent)
            },
            {
                path: 'aggregators',
                redirectTo: 'developers',
                pathMatch: 'full'
            }
        ]
    }
];
