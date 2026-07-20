import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { DegreeProcessService } from '../../../core/services/degree-process.service';
import { AuthService } from '../../../core/services/auth.service';
import {
  DegreeProcess,
  ProcessStatus,
} from '../../../core/models/degree-process.model';
import { UserRole } from '../../../core/models/user.model';
import { PaginatedResponse } from '../../../core/models/api-response.model';

@Component({
  selector: 'app-process-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './process-list.component.html',
  styleUrl: './process-list.component.css'
})
export class ProcessListComponent implements OnInit {
  processes = signal<DegreeProcess[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  viewType = signal<'my-process' | 'assigned' | 'all'>('my-process');

  // Filters
  searchQuery = signal('');
  selectedStatus = signal<ProcessStatus | ''>('');
  selectedModality = signal<string>('');

  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);
  totalItems = signal(0);

  // Computed values
  filteredProcesses = computed(() => {
    const processes = this.processes();
    const query = this.searchQuery().toLowerCase();
    const status = this.selectedStatus();
    const modality = this.selectedModality();

    return processes.filter(process => {
      const matchesSearch =
        process.title?.toLowerCase().includes(query) ||
        process.student?.firstName?.toLowerCase().includes(query) ||
        process.student?.lastName?.toLowerCase().includes(query);

      const matchesStatus = !status || process.status === status;
      const matchesModality = !modality || process.modality?.code === modality;

      return matchesSearch && matchesStatus && matchesModality;
    });
  });

  totalPages = computed(() => Math.ceil(this.totalItems() / this.pageSize()));

  statusLabels: Record<ProcessStatus, string> = {
    [ProcessStatus.DRAFT]: 'Borrador',
    [ProcessStatus.ACTIVE]: 'Activo',
    [ProcessStatus.IN_REVIEW]: 'En Revisión',
    [ProcessStatus.APPROVED]: 'Aprobado',
    [ProcessStatus.COMPLETED]: 'Completado',
    [ProcessStatus.ARCHIVED]: 'Archivado'
  };

  modalityLabels: Record<string, string> = {
    THESIS: 'Tesis',
    INTERNSHIP: 'Pasantía',
    RESEARCH_LINE: 'Línea de Investigación',
    DIPLOMA: 'Diplomado'
  };

  readonly UserRole = UserRole;
  readonly Math = Math;
  actionInProgress = signal<string | null>(null);

  statusOptions = Object.values(ProcessStatus);
  modalityOptions: string[] = [];

  userRole = computed(() => this.authService.userRole());
  currentUser = computed(() => this.authService.currentUser());
  currentFullUser = computed(() => this.authService.currentFullUser());

  constructor(
    private processService: DegreeProcessService,
    private authService: AuthService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Load modality options dynamically
    this.processService.getModalities().subscribe({
      next: (modalities) => {
        this.modalityOptions = modalities.map(m => m.code);
        for (const m of modalities) {
          this.modalityLabels[m.code] = m.name;
        }
      }
    });

    this.route.data.subscribe(data => {
      this.viewType.set(data['view'] || 'my-process');
      this.loadProcesses();
    });
  }

  loadProcesses(): void {
    this.loading.set(true);
    this.error.set(null);

    const view = this.viewType();

    if (view === 'my-process' || view === 'assigned') {
      // Student view: own processes. Advisor view: assigned processes.
      // Both are served by the backend's role-aware "my-processes" endpoint.
      this.processService.getMyProcesses().subscribe({
        next: (processes: DegreeProcess[]) => {
          this.processes.set(processes);
          this.totalItems.set(processes.length);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error loading my processes:', err);
          this.error.set('Error al cargar tus procesos. Intente de nuevo.');
          this.loading.set(false);
        }
      });
    } else {
      // All processes view: secretary/admin only.
      const params = {
        page: this.currentPage(),
        limit: this.pageSize(),
        ...(this.selectedStatus() && { status: this.selectedStatus() }),
        ...(this.selectedModality() && { modalityCode: this.selectedModality() })  // Correcto: el backend usa 'modalityCode'
      };

      this.processService.getProcesses(params).subscribe({
        next: (response: PaginatedResponse<DegreeProcess>) => {
          this.processes.set(response.data || []);
          this.totalItems.set(response.total || 0);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Error loading processes:', err);
          this.error.set('Error al cargar los procesos. Intente de nuevo.');
          this.loading.set(false);
        }
      });
    }
  }

  getViewTitle(): string {
    const titles: Record<string, string> = {
      'my-process': 'Mis Procesos de Grado',
      'assigned': 'Procesos Asignados',
      'all': 'Todos los Procesos'
    };
    return titles[this.viewType()] || 'Procesos';
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.currentPage.set(1);
  }

  onStatusChange(status: ProcessStatus | ''): void {
    this.selectedStatus.set(status);
    this.currentPage.set(1);
    this.loadProcesses();
  }

  onModalityChange(modality: string): void {
    this.selectedModality.set(modality);
    this.currentPage.set(1);
    this.loadProcesses();
  }

  getStatusBadgeClass(status: ProcessStatus): string {
    const baseClass = 'status-badge';
    const statusClass = {
      [ProcessStatus.DRAFT]: `${baseClass} status-draft`,
      [ProcessStatus.ACTIVE]: `${baseClass} status-active`,
      [ProcessStatus.IN_REVIEW]: `${baseClass} status-review`,
      [ProcessStatus.APPROVED]: `${baseClass} status-approved`,
      [ProcessStatus.COMPLETED]: `${baseClass} status-completed`,
      [ProcessStatus.ARCHIVED]: `${baseClass} status-archived`
    };
    return statusClass[status] || baseClass;
  }

  canEditProcess(process: DegreeProcess): boolean {
    const role = this.userRole();
    const user = this.currentUser();

    if (!user) return false;

    if (role === UserRole.ADMIN || role === UserRole.SUPERADMIN) return true;
    if (role === UserRole.STUDENT && process.studentId === user.sub) {
      return process.status === ProcessStatus.DRAFT;
    }
    if (role === UserRole.ADVISOR && process.advisorId === user.sub) {
      return [ProcessStatus.ACTIVE, ProcessStatus.IN_REVIEW].includes(process.status);
    }

    return false;
  }

  formatAdvisorName(advisor: any): string {
    if (!advisor) {
      if (this.userRole() === UserRole.ADVISOR) {
        const currentFullUser = this.currentFullUser();
        const firstName = currentFullUser?.firstName?.trim() || this.currentUser()?.firstName?.trim() || '';
        const lastName = currentFullUser?.lastName?.trim() || '';
        const fullName = [firstName, lastName].filter(Boolean).join(' ');
        return fullName || 'Asesor';
      }
      return 'No asignado';
    }

    const firstName = advisor.firstName?.trim() || '';
    const lastName = advisor.lastName?.trim() || '';

    if (firstName && lastName) {
      return `${firstName} ${lastName}`;
    } else if (firstName) {
      return firstName;
    } else if (lastName) {
      return lastName;
    }
    return 'No asignado';
  }

  deleteProcess(process: DegreeProcess): void {
    if (this.actionInProgress()) return;
    if (!confirm(`¿Deseas eliminar permanentemente el proceso de ${process.student?.firstName} ${process.student?.lastName}? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.actionInProgress.set(process.id);
    this.processService.deleteProcess(process.id).subscribe({
      next: () => {
        this.actionInProgress.set(null);
        this.loadProcesses();
      },
      error: (err) => {
        console.error('Error eliminando proceso:', err);
        this.actionInProgress.set(null);
      }
    });
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.loadProcesses();
    }
  }

  getPaginationPages(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push(-1); // -1 represents ellipsis
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < total) {
      if (end < total - 1) pages.push(-1);
      pages.push(total);
    }

    return pages;
  }
}
