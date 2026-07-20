import { Routes } from '@angular/router';

export const AUTH_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent)
  },
  {
    path: 'data-policy',
    loadComponent: () => import('./data-policy.component').then(m => m.DataPolicyComponent)
  },
  {
    path: '',
    redirectTo: '/auth/login',
    pathMatch: 'full'
  }
];
