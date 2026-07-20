/* Archivo : user-details.component.ts
   Descripción : Componente de detalles del usuario para la gestión de usuarios en el panel de administración.
   Muestra información detallada del usuario seleccionado y maneja la carga de datos y errores. */

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { User } from '../../../core/models/user.model';

@Component({
  selector: 'app-user-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-details.component.html',
  styleUrls: ['./user-details.component.css']
})
export class UserDetailsComponent implements OnInit {
  user: User | null = null;
  loading = true;
  error = '';
  rawError: any = null;

  constructor(private route: ActivatedRoute, private adminService: AdminService) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = 'Usuario no especificado.';
      this.loading = false;
      return;
    }

    this.adminService.getUserById(id).subscribe({
      next: (u) => {
        this.user = u;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando detalle de usuario:', err);
        // Provide a more informative message for debugging
        const status = err?.status ?? 'N/A';
        const msg = err?.error?.message || err?.message || err?.statusText || 'Error desconocido';
        this.rawError = err;
        this.error = `Error al cargar los datos del usuario. (${status}) ${msg}`;
        this.loading = false;
      }
    });
  }

  getRoleLabel(role: string): string {
    switch (role) {
      case 'STUDENT':
        return 'Estudiante';
      case 'ADVISOR':
        return 'Asesor';
      case 'SECRETARY':
        return 'Secretaria';
      case 'ADMIN':
        return 'Administrador';
      case 'SUPERADMIN':
        return 'Super Admin';
      default:
        return role;
    }
  }

  goBack(): void {
    history.back();
  }
}
