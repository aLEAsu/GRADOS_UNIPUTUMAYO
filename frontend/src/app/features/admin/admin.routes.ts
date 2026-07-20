import { Routes } from '@angular/router';
import { UserManagementComponent } from './user-management/user-management.component';
import { UserDetailsComponent } from './user-management/user-details.component';
import { ModalityManagementComponent } from './modality-management/modality-management.component';
import { AuditLogComponent } from './audit-log/audit-log.component';
import { SignatureManagementComponent } from './signature-management/signature-management.component';

export const adminRoutes: Routes = [
  {
    path: 'users',
    component: UserManagementComponent,
    data: { title: 'Gestión de Usuarios' }
  },
  {
    path: 'users/:id',
    component: UserDetailsComponent,
    data: { title: 'Detalle Usuario' }
  },
  {
    path: 'modalities',
    component: ModalityManagementComponent,
    data: { title: 'Gestión de Modalidades' }
  },
  {
    path: 'signatures',
    component: SignatureManagementComponent,
    data: { title: 'Gestión de Firmas' }
  },
  {
    path: 'audit',
    component: AuditLogComponent,
    data: { title: 'Log de Auditoría' }
  },
  {
    path: '',
    redirectTo: 'users',
    pathMatch: 'full'
  }
];
