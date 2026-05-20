import { Component, computed, signal, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { UserRole } from '../../../core/models/user.model';

interface MenuItem {
  label: string;
  icon: string;
  routerLink: string;
  roles?: UserRole[];
  badge?: number;
}

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css'
})
export class LayoutComponent implements OnInit, OnDestroy {
  sidebarCollapsed = signal(false);
  mobileMenuOpen = signal(false);
  userMenuOpen = signal(false);
  notificationPanelOpen = signal(false);

  currentUser = this.authService.currentUser;
  unreadCount = this.notificationService.unreadCount;
  notifications = this.notificationService.notifications;

  menuItems = computed<MenuItem[]>(() => {
    const role = this.authService.userRole();
    const allItems: MenuItem[] = [
      {
        label: 'Dashboard',
        icon: 'pi pi-home',
        routerLink: '/dashboard',
      },
      {
        label: 'Mi Proceso',
        icon: 'pi pi-file',
        routerLink: '/process/my-process',
        roles: [UserRole.STUDENT],
      },
      {
        label: 'Inscripción',
        icon: 'pi pi-plus-circle',
        routerLink: '/process/new',
        roles: [UserRole.STUDENT],
      },
      {
        label: 'Procesos Asignados',
        icon: 'pi pi-users',
        routerLink: '/process/assigned',
        roles: [UserRole.ADVISOR],
      },
      {
        label: 'Revisiones Pendientes',
        icon: 'pi pi-check-square',
        routerLink: '/reviews/pending',
        roles: [UserRole.ADVISOR],
      },
      {
        label: 'Gestión Documentos',
        icon: 'pi pi-folder-open',
        routerLink: '/reviews/administrative',
        roles: [UserRole.SECRETARY],
      },
      {
        label: 'Todos los Procesos',
        icon: 'pi pi-list',
        routerLink: '/process/all',
        roles: [UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN],
      },
      {
        label: 'Usuarios',
        icon: 'pi pi-users',
        routerLink: '/admin/users',
        roles: [UserRole.ADMIN, UserRole.SUPERADMIN],
      },
      {
        label: 'Modalidades',
        icon: 'pi pi-cog',
        routerLink: '/admin/modalities',
        roles: [UserRole.ADMIN, UserRole.SUPERADMIN],
      },
      {
        label: 'Firmas Digitales',
        icon: 'pi pi-pencil',
        routerLink: '/admin/signatures',
        roles: [UserRole.ADMIN, UserRole.SUPERADMIN],
      },
      {
        label: 'Auditoría',
        icon: 'pi pi-history',
        routerLink: '/admin/audit',
        roles: [UserRole.ADMIN, UserRole.SUPERADMIN],
      },
    ];

    return allItems.filter(item => {
      if (!item.roles) return true;
      return role ? item.roles.includes(role) : false;
    });
  });

  private pollingSub?: Subscription;

  constructor(
    public authService: AuthService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.notificationService.loadNotifications().subscribe({ error: () => {} });
    this.pollingSub = this.notificationService.startPolling(60000);
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }

  toggleMobileMenu(): void {
    this.mobileMenuOpen.update(v => !v);
  }

  toggleUserMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.userMenuOpen.update(v => !v);
    if (this.userMenuOpen()) {
      this.notificationPanelOpen.set(false);
    }
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.notificationPanelOpen.update(v => !v);
    if (this.notificationPanelOpen()) {
      this.userMenuOpen.set(false);
    }
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.userMenuOpen.set(false);
    this.notificationPanelOpen.set(false);
  }

  markNotificationRead(id: string): void {
    this.notificationService.markAsRead(id).subscribe();
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }

  logout(): void {
    this.authService.logout();
  }

  getRoleLabel(role: UserRole | null): string {
    const labels: Record<string, string> = {
      STUDENT: 'Estudiante',
      ADVISOR: 'Asesor',
      SECRETARY: 'Secretaria',
      ADMIN: 'Administrador',
      SUPERADMIN: 'Super Admin',
    };
    return role ? labels[role] || role : '';
  }

  getUserInitials(): string {
    const user = this.currentUser();
    if (!user) return '?';
    return (user.firstName?.charAt(0) || '').toUpperCase();
  }
}
