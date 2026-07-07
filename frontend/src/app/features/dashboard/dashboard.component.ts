import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { DegreeProcessService } from '../../core/services/degree-process.service';
import { ReviewService } from '../../core/services/review.service';
import { UserRole } from '../../core/models/user.model';
import { DashboardStats } from '../../core/models/api-response.model';
import { DegreeProcess, ProcessStatus } from '../../core/models/degree-process.model';
import {HttpClient} from "@angular/common/http";

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  currentUser = this.authService.currentUser;
  userRole = this.authService.userRole;

  stats = signal<DashboardStats | null>(null);
  myProcesses = signal<DegreeProcess[]>([]);
  pendingReviews = signal<any[]>([]);
  isLoading = signal(true);

  readonly UserRole = UserRole;
  readonly ProcessStatus = ProcessStatus;

  constructor(
    private authService: AuthService,
    private adminService: AdminService,
    private processService: DegreeProcessService,
    private reviewService: ReviewService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    const role = this.userRole();

    if (role === UserRole.STUDENT) {
      this.processService.getMyProcesses().subscribe({
        next: processes => {
          this.myProcesses.set(processes);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    } else if (role === UserRole.ADVISOR) {
      this.reviewService.getPendingAcademicReviews().subscribe({
        next: reviews => {
          this.pendingReviews.set(reviews.map(item => this.mapReviewItem(item)));
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    } else if (role === UserRole.SECRETARY || role === UserRole.ADMIN || role === UserRole.SUPERADMIN) {
      this.adminService.getDashboardStats().subscribe({
        next: stats => {
          this.stats.set(stats);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    } else {
      this.isLoading.set(false);
    }
  }

  private mapReviewItem(item: any): any {
    const latestDocument = item.documentVersions?.[0];
    const student = item.degreeProcess?.student;
    const documentType = item.modalityRequirement?.documentType;

    return {
      ...item,
      processId: item.degreeProcess?.id,
      requirementInstanceId: item.id,
      documentVersionId: latestDocument?.id,
      documentName: documentType?.name || latestDocument?.originalFileName || 'Documento',
      studentName: student ? `${student.firstName} ${student.lastName}` : '',
      title: item.degreeProcess?.title || item.degreeProcess?.modality?.name || 'Proceso de grado',
      processTitle: item.degreeProcess?.title || item.degreeProcess?.modality?.name || 'Proceso de grado',
      uploadDate: latestDocument?.uploadedAt || item.updatedAt || item.createdAt
    };
  }

  getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 18) return 'Buenas tardes';
    return 'Buenas noches';
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

  private normalizeStatus(status?: string): string {
    return status?.toString().trim().toUpperCase() || '';
  }

  getStatusLabel(status: string): string {
    const normalized = this.normalizeStatus(status);
    const labels: Record<string, string> = {
      DRAFT: 'Borrador',
      ACTIVE: 'Activo',
      IN_REVIEW: 'En Revisión',
      APPROVED: 'Aprobado',
      COMPLETED: 'Completado',
      ARCHIVED: 'Archivado'
    };
    return labels[normalized] || 'Estado desconocido';
  }

  getStatusClass(status: string): string {
    const normalized = this.normalizeStatus(status);
    const classes: Record<string, string> = {
      DRAFT: 'status-draft',
      ACTIVE: 'status-active',
      IN_REVIEW: 'status-review',
      APPROVED: 'status-approved',
      COMPLETED: 'status-completed',
      ARCHIVED: 'status-archived'
    };
    return classes[normalized] || 'status-unknown';
  }

  getActiveCount(): number {
    return this.myProcesses().filter(
      p => {
        const status = this.normalizeStatus(p.status);
        return status === ProcessStatus.ACTIVE || status === ProcessStatus.IN_REVIEW;
      }
    ).length;
  }

  getModalityLabel(code: string): string {
    const labels: Record<string, string> = {
      THESIS: 'Tesis',
      INTERNSHIP: 'Pasantía',
      RESEARCH_LINE: 'Línea de Investigación',
      DIPLOMA: 'Diplomado'
    };
    return labels[code] || 'Otra modalidad';
  }

  getModalityPercentage(count: number): number {
    const total = this.stats()?.totalProcesses || 1; // Establece un valor predeterminado para evitar división por cero
    return (count / total) * 100;
  }
}
