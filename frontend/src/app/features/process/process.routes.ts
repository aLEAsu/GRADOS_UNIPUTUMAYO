import { Routes } from '@angular/router';
import { ProcessListComponent } from './process-list/process-list.component';
import { ProcessNewComponent } from './process-new/process-new.component';
import { ProcessDetailComponent } from './process-detail/process-detail.component';
import { roleGuard } from '../../core/guards/role.guard';
import { UserRole } from '../../core/models/user.model';

export const PROCESS_ROUTES: Routes = [
  {
    path: '',
    children: [
      {
        path: 'new',
        component: ProcessNewComponent,
        canActivate: [roleGuard],
        data: { title: 'Nueva Inscripcion', roles: [UserRole.STUDENT] }
      },
      {
        path: 'my-process',
        component: ProcessListComponent,
        canActivate: [roleGuard],
        data: { title: 'Mis Procesos', view: 'my-process', roles: [UserRole.STUDENT] }
      },
      {
        path: 'assigned',
        component: ProcessListComponent,
        canActivate: [roleGuard],
        data: { title: 'Procesos Asignados', view: 'assigned', roles: [UserRole.ADVISOR] }
      },
      {
        path: 'all',
        component: ProcessListComponent,
        canActivate: [roleGuard],
        data: {
          title: 'Todos los Procesos',
          view: 'all',
          roles: [UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN]
        }
      },
      {
        path: ':id',
        component: ProcessDetailComponent,
        data: { title: 'Detalle del Proceso' }
      },
      {
        path: '',
        redirectTo: 'my-process',
        pathMatch: 'full'
      }
    ]
  }
];
