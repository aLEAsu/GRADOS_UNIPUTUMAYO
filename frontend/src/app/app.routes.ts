import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './core/models/user.model';
import { LayoutComponent } from './shared/components/layout/layout.component';

export const routes: Routes = [
  // Auth routes (no layout, guest only)
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () => import('./features/auth/auth.routes').then(m => m.AUTH_ROUTES)
  },

  // Protected routes (with layout)
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent)
      },

      // Profile
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component').then(m => m.ProfileComponent)
      },

      // Process routes
      {
        path: 'process',
        loadChildren: () => import('./features/process/process.routes').then(m => m.PROCESS_ROUTES)
      },

      // Reviews routes (restricted to ADVISOR, SECRETARY, ADMIN, SUPERADMIN)
      {
        path: 'reviews',
        canActivate: [roleGuard],
        data: { roles: [UserRole.ADVISOR, UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN] },
        loadChildren: () => import('./features/reviews/reviews.routes').then(m => m.reviewsRoutes)
      },

      // Admin routes
      {
        path: 'admin',
        canActivate: [roleGuard],
        data: { roles: [UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SECRETARY] },
        loadChildren: () => import('./features/admin/admin.routes').then(m => m.adminRoutes)
      },

      // Default redirect
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }
    ]
  },

  // Wildcard
  {
    path: '**',
    redirectTo: '/auth/login'
  }
];
