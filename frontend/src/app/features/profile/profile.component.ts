import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { User, UserRole, StudentProfile, AdvisorProfile } from '../../core/models/user.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '@environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  private readonly apiUrl = `${environment.apiUrl}/users`;

  user = signal<User | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  successMessage = signal('');
  editMode = signal(false);

  // Editable fields
  firstName = '';
  lastName = '';
  phone = '';

  // Student profile fields
  studentCode = '';
  program = '';
  faculty = '';
  semester = 1;

  // Advisor profile fields
  department = '';
  specialization = '';

  currentUser = this.authService.currentUser;
  userRole = this.authService.userRole;
  readonly UserRole = UserRole;

  constructor(
    private authService: AuthService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.error.set('');

    this.http.get<User>(`${this.apiUrl}/me`).subscribe({
      next: (user) => {
        this.user.set(user);
        this.populateForm(user);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando perfil:', err);
        this.error.set('Error al cargar el perfil.');
        this.loading.set(false);
      }
    });
  }

  populateForm(user: User): void {
    this.firstName = user.firstName;
    this.lastName = user.lastName;
    this.phone = user.phone || '';

    if (user.studentProfile) {
      this.studentCode = user.studentProfile.studentCode;
      this.program = user.studentProfile.program;
      this.faculty = (user.studentProfile as any).faculty || '';
      this.semester = user.studentProfile.semester;
    }

    if (user.advisorProfile) {
      this.department = user.advisorProfile.department;
      this.specialization = user.advisorProfile.specialization;
    }
  }

  toggleEdit(): void {
    this.editMode.update(v => !v);
    if (!this.editMode()) {
      const user = this.user();
      if (user) this.populateForm(user);
    }
    this.successMessage.set('');
    this.error.set('');
  }

  saveProfile(): void {
    this.saving.set(true);
    this.error.set('');
    this.successMessage.set('');

    const data: any = {
      firstName: this.firstName,
      lastName: this.lastName,
      phone: this.phone || undefined
    };

    this.http.patch<User>(`${this.apiUrl}/me`, data).subscribe({
      next: (updated) => {
        this.user.set(updated);
        this.saving.set(false);
        this.editMode.set(false);
        this.successMessage.set('Perfil actualizado correctamente.');
        // Refresh shared full profile so UI (layout banner) updates
        this.authService.getMyFullProfile().subscribe({ error: () => {} });
      },
      error: (err) => {
        console.error('Error actualizando perfil:', err);
        this.error.set('Error al actualizar el perfil.');
        this.saving.set(false);
      }
    });
  }

  createStudentProfile(): void {
    if (!this.studentCode || !this.program) {
      this.error.set('Código de estudiante y programa son obligatorios.');
      return;
    }

    this.saving.set(true);
    this.error.set('');

    this.http.post<StudentProfile>(`${this.apiUrl}/me/student-profile`, {
      studentCode: this.studentCode,
      program: this.program,
      faculty: this.faculty,
      semester: this.semester
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.successMessage.set('Perfil de estudiante creado correctamente.');
        this.loadProfile();
        // Refresh global profile signal
        this.authService.getMyFullProfile().subscribe({ error: () => {} });
      },
      error: (err) => {
        console.error('Error creando perfil de estudiante:', err);
        this.error.set(err.error?.message || 'Error al crear el perfil de estudiante.');
        this.saving.set(false);
      }
    });
  }

  getRoleLabel(): string {
    const labels: Record<string, string> = {
      STUDENT: 'Estudiante',
      ADVISOR: 'Asesor Académico',
      SECRETARY: 'Secretaria Académica',
      ADMIN: 'Administrador',
      SUPERADMIN: 'Super Administrador',
    };
    return labels[this.userRole() || ''] || '';
  }

  getAcademicStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      ACTIVE: 'Activo',
      INACTIVE: 'Inactivo',
      GRADUATED: 'Graduado',
      SUSPENDED: 'Suspendido'
    };
    return labels[status] || status;
  }

  getUserInitials(): string {
    const u = this.user();
    if (!u) return '?';
    return ((u.firstName?.charAt(0) || '') + (u.lastName?.charAt(0) || '')).toUpperCase();
  }
}
