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
    // Load existing notifications and start polling
    this.notificationService.loadNotifications().subscribe({ error: () => {} });
    this.pollingSub = this.notificationService.startPolling(60000);

    // Load full user profile and check completeness; if incomplete, create a notification (non-intrusive)
    this.authService.getMyFullProfile().subscribe({
      next: (user) => this.handleProfileCheckAndNotify(user),
      error: () => {
        // ignore errors (unauthenticated or backend unavailable)
      }
    });
  }

  private handleProfileCheckAndNotify(user: any): void {
    if (!user) return;
    const missing: string[] = [];

    if (!user.phone) missing.push('Teléfono');
    if (!user.firstName) missing.push('Nombre');
    if (!user.lastName) missing.push('Apellidos');

    const role = user.role;
    if (role === 'STUDENT') {
      if (!user.studentProfile?.studentCode) missing.push('Código estudiante');
      if (!user.studentProfile?.program) missing.push('Programa');
    }
    if (role === 'ADVISOR') {
      if (!user.advisorProfile?.department) missing.push('Departamento');
      if (!user.advisorProfile?.specialization) missing.push('Especialización');
    }

    if (missing.length === 0) return; // nothing to do

    // Avoid creating duplicate notifications: check existing unread notifications with same title
    const existing = (this.notificationService.notifications() || []).find(n => !n.isRead && n.title === 'Completa tu perfil');
    if (existing) return;

    const message = `Faltan los siguientes datos en tu perfil: ${missing.join(', ')}.`;

    // Create notification for current user (server-side persisted)
    this.notificationService.createNotification({ type: 'GENERAL', title: 'Completa tu perfil', message, metadata: { missingFields: missing, target: '/profile' } })
      .subscribe({
        next: () => {
          // reload notifications already triggered inside service
        },
        error: () => {
          // if backend fails, we silently ignore to avoid harming UX
        }
      });
  }

  ngOnDestroy(): void {
    this.pollingSub?.unsubscribe();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
    this.mobileMenuOpen.set(false);
  }

  toggleMobileMenu(): void {
    if(!this.mobileMenuOpen()) {
      this.sidebarCollapsed.set(false);
    }
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

  handleNotificationClick(notif: any): void {
    // Mark as read first, then navigate to target if provided
    this.notificationService.markAsRead(notif.id).subscribe({
      next: () => {
        const target = notif?.metadata?.target || (notif?.metadata?.processId ? `/process/${notif.metadata.processId}` : null);
        if (target) {
          this.router.navigate([target]);
        }
      },
      error: () => {
        // still attempt navigation even if marking failed
        const target = notif?.metadata?.target || (notif?.metadata?.processId ? `/process/${notif.metadata.processId}` : null);
        if (target) {
          this.router.navigate([target]);
        }
      }
    });
  }

  markAllRead(): void {
    this.notificationService.markAllAsRead().subscribe();
  }

  deleteNotification(id: string): void {
    this.notificationService.deleteNotification(id).subscribe({
      next: () => {},
      error: () => {},
    });
  }

  showDeleteAllConfirm = signal(false);

  deleteAllNotifications(): void {
    // open custom confirm modal
    this.showDeleteAllConfirm.set(true);
  }

  confirmDeleteAll(): void {
    this.notificationService.deleteAllNotifications().subscribe({ next: () => {
      this.showDeleteAllConfirm.set(false);
    }, error: () => {
      this.showDeleteAllConfirm.set(false);
    } });
  }

  cancelDeleteAll(): void {
    this.showDeleteAllConfirm.set(false);
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
