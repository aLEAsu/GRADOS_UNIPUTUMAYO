import { Routes } from '@angular/router';
import { PendingReviewsComponent } from './pending-reviews/pending-reviews.component';
import { AdminReviewsComponent } from './admin-reviews/admin-reviews.component';
import { roleGuard } from '../../core/guards/role.guard';
import { UserRole } from '../../core/models/user.model';

export const reviewsRoutes: Routes = [
  {
    path: 'pending',
    component: PendingReviewsComponent,
    canActivate: [roleGuard],
    data: { roles: [UserRole.ADVISOR] }
  },
  {
    path: 'administrative',
    component: AdminReviewsComponent,
    canActivate: [roleGuard],
    data: { roles: [UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN] }
  },
  {
    path: '',
    redirectTo: 'pending',
    pathMatch: 'full'
  }
];
