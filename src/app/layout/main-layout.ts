import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SidebarComponent } from './sidebar/sidebar';
import { HeaderComponent } from './header/header';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, SidebarComponent, HeaderComponent],
  template: `
    <div class="layout-wrapper">
      <app-sidebar></app-sidebar>
      <div class="main-content">
        <app-header></app-header>
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
    }
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0; // Important for nested flex/grid containers to not overflow
    }
    .page-content {
      margin-left: var(--sidebar-width);
      padding: 2rem;
      background: var(--bg-main);
      min-height: calc(100vh - var(--header-height));
      width: calc(100% - var(--sidebar-width));
    }
    @media (max-width: 768px) {
      .page-content {
        margin-left: 0;
        width: 100%;
        padding: 1rem;
      }
    }
  `]
})
export class MainLayoutComponent { }
