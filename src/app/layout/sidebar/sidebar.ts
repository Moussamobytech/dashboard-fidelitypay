import { Component, inject, computed, Output, EventEmitter } from '@angular/core';
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
  @Output() closeSidebar = new EventEmitter<void>();
  readonly authService = inject(AuthService);

  readonly menuItems = computed(() => {
    const role = this.authService.userRole();
    const items = [];

    if (role === 'ADMIN') {
      items.push({ icon: 'dashboard', label: 'Dashboard', route: '/dashboard' });
      items.push({ icon: 'payments', label: 'Transactions', route: '/transactions' });
      items.push({ icon: 'insights', label: 'Analytics', route: '/analytics' });
      items.push({ icon: 'alt_route', label: 'Routage', route: '/routing' });
      items.push({ icon: 'code', label: 'Développeurs', route: '/developers' });
      items.push({ icon: 'vpn_key', label: 'Clés API', route: '/api-keys' });
      items.push({ icon: 'people', label: 'Utilisateurs', route: '/users' });
    } else {
      items.push({ icon: 'dashboard', label: 'Dashboard', route: '/developer-dashboard' });
      items.push({ icon: 'payments', label: 'Transactions', route: '/developer-transactions' });
      items.push({ icon: 'insights', label: 'Analytics', route: '/analytics' });
      items.push({ icon: 'alt_route', label: 'Routage', route: '/routing' });
      items.push({ icon: 'code', label: 'Intégration', route: '/developers' });
      items.push({ icon: 'vpn_key', label: 'Clés API', route: '/api-keys' });
      items.push({ icon: 'play_circle', label: 'Tester paiement', route: '/payment-test' });
    }

    return items;
  });

  logout(): void {
    this.authService.logout();
  }

  handleLinkClick(): void {
    this.closeSidebar.emit();
  }
}
