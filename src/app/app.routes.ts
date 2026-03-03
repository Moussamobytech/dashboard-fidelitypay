import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout';
import { DashboardOverviewComponent } from './modules/dashboard/overview/overview';
import { RoutingConfigComponent } from './modules/routing/routing';
import { MonitoringComponent } from './modules/monitoring/monitoring';
import { LogsComponent } from './modules/logs/logs';
import { roleRedirectGuard } from './core/guards/role-redirect.guard';

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
        path: '',
        component: MainLayoutComponent,
        children: [
            { path: '', canActivate: [roleRedirectGuard], component: MainLayoutComponent },
            { path: 'dashboard', component: DashboardOverviewComponent },
            { path: 'routing', component: RoutingConfigComponent },
            { path: 'monitoring', component: MonitoringComponent },
            { path: 'logs', component: LogsComponent },
            {
                path: 'transactions',
                loadComponent: () => import('./modules/transactions/transactions.component').then(m => m.TransactionsComponent)
            },
            {
                path: 'analytics',
                loadComponent: () => import('./modules/analytics/analytics').then(m => m.AnalyticsComponent)
            },
            {
                path: 'settings',
                loadComponent: () => import('./modules/settings/settings').then(m => m.SettingsComponent)
            },
            {
                path: 'developers',
                loadComponent: () => import('./modules/developers/developers').then(m => m.DevelopersComponent)
            },
            {
                path: 'developer-dashboard',
                loadComponent: () => import('./modules/developers/dashboard/developer-dashboard').then(m => m.DeveloperDashboardComponent)
            },
            {
                path: 'developer-transactions',
                loadComponent: () => import('./modules/developers/transactions/developer-transactions').then(m => m.DeveloperTransactionsComponent)
            },
            {
                path: 'developer-monitoring',
                loadComponent: () => import('./modules/developers/monitoring/developer-monitoring').then(m => m.DeveloperMonitoringComponent)
            }
        ]
    }
];
