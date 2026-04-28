import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from './sidebar/sidebar';
import { HeaderComponent } from './header/header';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, HeaderComponent],
  template: `
    <div class="layout-wrapper" [class.sidebar-opened]="isSidebarOpened()">
      <div class="sidebar-overlay" (click)="toggleSidebar()"></div>
      <app-sidebar class="sidebar-container" (closeSidebar)="isSidebarOpened.set(false)"></app-sidebar>
      <div class="main-content">
        <app-header (toggleSidebar)="toggleSidebar()"></app-header>
        <main class="page-content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout-wrapper {
      display: flex;
      min-height: 100vh;
      width: 100%;
      overflow-x: hidden;
      position: relative;
    }
    .sidebar-container {
      display: block; /* Ensure the custom element takes space */
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .sidebar-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(6px);
      z-index: 95;
    }
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      margin-left: var(--sidebar-width);
      transition: margin-left 0.3s ease;
    }
    .page-content {
      padding: 2rem;
      background: var(--bg-main);
      min-height: calc(100vh - var(--header-height));
    }
    @media (max-width: 1024px) {
      .page-content {
        padding: 1.5rem;
      }
    }
    @media (max-width: 768px) {
      .sidebar-container {
        position: fixed;
        top: 0;
        left: 0;
        height: 100vh;
        width: 280px;
        transform: translateX(-100%);
        z-index: 100;
        box-shadow: 20px 0 50px rgba(0,0,0,0.2);
      }
      .sidebar-opened {
        .sidebar-container {
          transform: translateX(0);
        }
        .sidebar-overlay {
          display: block;
        }
      }
      .main-content {
        margin-left: 0;
      }
      .page-content {
        padding: 1rem;
      }
    }
  `]
})
export class MainLayoutComponent {
  isSidebarOpened = signal(false);

  toggleSidebar() {
    this.isSidebarOpened.update(val => !val);
  }
}
