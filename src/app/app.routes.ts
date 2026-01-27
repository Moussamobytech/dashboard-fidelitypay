import { Routes } from '@angular/router';
import { MainLayoutComponent } from './layout/main-layout';
import { DashboardOverviewComponent } from './modules/dashboard/overview/overview';
import { RoutingConfigComponent } from './modules/routing/routing';
import { MonitoringComponent } from './modules/monitoring/monitoring';
import { LogsComponent } from './modules/logs/logs';

export const routes: Routes = [
    {
        path: '',
        component: MainLayoutComponent,
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
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
        ]
    }
];
