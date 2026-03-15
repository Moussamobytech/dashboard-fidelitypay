import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss']
})
export class SidebarComponent {

  readonly authService = inject(AuthService);

  readonly menuItems = computed(() => {
    const role = this.authService.userRole();
    const items = [];

    if (role === 'DEVELOPER') {
      items.push({ icon: 'dashboard', label: 'Dashboard', route: '/developer-dashboard' });
      items.push({ icon: 'payments', label: 'Transactions', route: '/developer-transactions' });
      items.push({ icon: 'router', label: 'Monitoring', route: '/developer-monitoring' });
      items.push({ icon: 'code', label: 'Intégration & Clés', route: '/developers' });
    } else {
      items.push({ icon: 'dashboard', label: 'Dashboard', route: '/dashboard' });
      items.push({ icon: 'payments', label: 'Transactions', route: '/transactions' });
      items.push({ icon: 'router', label: 'Monitoring', route: '/monitoring' });
      items.push({ icon: 'code', label: 'Développeurs', route: '/developers' });
      if (role === 'ADMIN') {
        items.push({ icon: 'people', label: 'Utilisateurs', route: '/users' });
      }
    }

    return items;
  });

  logout(): void {
    this.authService.logout();
  }
}
