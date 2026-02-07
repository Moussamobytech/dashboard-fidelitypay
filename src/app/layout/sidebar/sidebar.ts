import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss']
})
export class SidebarComponent {
  menuItems = [
    { icon: 'dashboard', label: 'Dashboard', route: '/dashboard' },
    { icon: 'payments', label: 'Transactions', route: '/transactions' },
    // { icon: 'router', label: 'Routing', route: '/routing' },
    { icon: 'router', label: 'Monitoring', route: '/monitoring' },
    // { icon: 'analytics', label: 'Analytics', route: '/analytics' },
    // { icon: 'description', label: 'Logs', route: '/logs' },
    // { icon: 'settings', label: 'Settings', route: '/settings' },
  ];
}
