import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { User, UserRole } from '../../../core/models/user.model';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './user-management.component.html',
  styleUrl: './user-management.component.css'
})
export class UserManagementComponent implements OnInit {
  users = signal<User[]>([]);
  loading = signal(true);
  error = signal('');
  searchTerm = '';
  filterRole = 'all';
  filterStatus = 'all';
  processingId: string | null = null;
  roleChangingId: string | null = null;
  currentPage = 1;
  totalPages = 1;
  total = 0;

  roles = Object.values(UserRole);

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set('');

    const params: any = { page: this.currentPage, limit: 20 };
    if (this.filterRole !== 'all') params.role = this.filterRole;
    if (this.searchTerm) params.search = this.searchTerm;

    this.adminService.getUsers(params).subscribe({
      next: (response) => {
        this.users.set(response.data);
        this.total = response.total;
        this.totalPages = response.totalPages;
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando usuarios:', err);
        this.error.set('Error al cargar los usuarios.');
        this.loading.set(false);
      }
    });
  }

  get filteredUsers(): User[] {
    let result = this.users();
    if (this.filterStatus !== 'all') {
      const isActive = this.filterStatus === 'active';
      result = result.filter(u => u.isActive === isActive);
    }
    return result;
  }

  toggleUserActive(user: User): void {
    if (this.processingId) return;
    this.processingId = user.id;

    this.adminService.toggleUserActive(user.id).subscribe({
      next: (updated) => {
        this.users.update(users =>
          users.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u)
        );
        this.processingId = null;
      },
      error: (err) => {
        console.error('Error al cambiar estado del usuario:', err);
        this.processingId = null;
      }
    });
  }

  onSearch(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  onFilterChange(): void {
    this.currentPage = 1;
    this.loadUsers();
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.loadUsers();
    }
  }

  prevPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
      this.loadUsers();
    }
  }

  getRoleLabel(role: UserRole): string {
    const labels: Record<string, string> = {
      STUDENT: 'Estudiante',
      ADVISOR: 'Asesor',
      SECRETARY: 'Secretaria',
      ADMIN: 'Administrador',
      SUPERADMIN: 'Super Admin',
    };
    return labels[role] || role;
  }

  getRoleClass(role: UserRole): string {
    const classes: Record<string, string> = {
      STUDENT: 'role-student',
      ADVISOR: 'role-advisor',
      SECRETARY: 'role-secretary',
      ADMIN: 'role-admin',
      SUPERADMIN: 'role-superadmin',
    };
    return classes[role] || '';
  }

  getInitials(user: User): string {
    return ((user.firstName?.charAt(0) || '') + (user.lastName?.charAt(0) || '')).toUpperCase();
  }

  changeRole(user: User, newRole: UserRole): void {
    if (newRole === user.role || this.roleChangingId) return;

    this.roleChangingId = user.id;
    this.adminService.changeUserRole(user.id, newRole).subscribe({
      next: (updated) => {
        this.users.update(users =>
          users.map(u => u.id === user.id ? { ...u, role: updated.role as UserRole } : u)
        );
        this.roleChangingId = null;
      },
      error: (err) => {
        console.error('Error al cambiar rol:', err);
        this.error.set('Error al cambiar el rol del usuario.');
        this.roleChangingId = null;
        // Recargar para restaurar el estado real
        this.loadUsers();
      }
    });
  }
}
