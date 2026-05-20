import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DegreeProcessService } from '../../../core/services/degree-process.service';
import { DocumentService } from '../../../core/services/document.service';
import { ReviewService } from '../../../core/services/review.service';
import { AuthService } from '../../../core/services/auth.service';
import { SignatureService } from '../../../core/services/signature.service';
import {
  DegreeProcess,
  ProcessStatus,
  DocumentStatus,
  RequirementInstance,
  Approval,
  ApprovalDecision,
  ApprovalType
} from '../../../core/models/degree-process.model';
import { UserRole } from '../../../core/models/user.model';

type TabType = 'requirements' | 'documents' | 'approvals' | 'timeline';

@Component({
  selector: 'app-process-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './process-detail.component.html',
  styleUrl: './process-detail.component.css'
})
export class ProcessDetailComponent implements OnInit {
  process = signal<DegreeProcess | null>(null);
  loading = signal(false);
  error = signal<string | null>(null);
  activeTab = signal<TabType>('requirements');
  fileUploadInProgress = signal(false);
  actionInProgress = signal(false);
  successMessage = signal('');

  // Advisor assignment
  availableAdvisors = signal<any[]>([]);
  selectedAdvisorId = '';
  showAdvisorModal = signal(false);

  processId = '';

  statusLabels: Record<ProcessStatus, string> = {
    [ProcessStatus.DRAFT]: 'Borrador',
    [ProcessStatus.ACTIVE]: 'Activo',
    [ProcessStatus.IN_REVIEW]: 'En Revisión',
    [ProcessStatus.APPROVED]: 'Aprobado',
    [ProcessStatus.COMPLETED]: 'Completado',
    [ProcessStatus.ARCHIVED]: 'Archivado'
  };

  documentStatusLabels: Record<DocumentStatus, string> = {
    [DocumentStatus.POR_CARGAR]: 'Por Cargar',
    [DocumentStatus.PENDIENTE]: 'Pendiente',
    [DocumentStatus.EN_REVISION]: 'En Revisión',
    [DocumentStatus.EN_CORRECCION]: 'En Corrección',
    [DocumentStatus.APROBADO]: 'Aprobado',
    [DocumentStatus.FINALIZADO]: 'Finalizado'
  };

  approvalDecisionLabels: Record<ApprovalDecision, string> = {
    [ApprovalDecision.APPROVED]: 'Aprobado',
    [ApprovalDecision.REJECTED]: 'Rechazado',
    [ApprovalDecision.REVISION_REQUESTED]: 'Requiere Corrección'
  };

  readonly ProcessStatus = ProcessStatus;
  readonly DocumentStatus = DocumentStatus;
  readonly ApprovalType = ApprovalType;
  readonly UserRole = UserRole;

  userRole = computed(() => this.authService.userRole());
  currentUser = computed(() => this.authService.currentUser());

  processProgress = computed(() => {
    const proc = this.process();
    if (!proc || !proc.requirementInstances) return 0;
    const total = proc.requirementInstances.length;
    if (total === 0) return 0;
    const completed = proc.requirementInstances.filter(
      r => r.status === DocumentStatus.APROBADO || r.status === DocumentStatus.FINALIZADO
    ).length;
    return Math.round((completed / total) * 100);
  });

  canActivateProcess = computed(() => {
    const proc = this.process();
    const role = this.userRole();
    const user = this.currentUser();
    if (!proc || !user) return false;
    const isOwner = proc.studentId === user.sub || proc.student?.id === user.sub;
    return proc.status === ProcessStatus.DRAFT
      && role === UserRole.STUDENT
      && isOwner
      && !!proc.advisorId;
  });

  canAssignAdvisor = computed(() => {
    const proc = this.process();
    const role = this.userRole();
    if (!proc) return false;
    return !proc.advisorId
      && (role === UserRole.SECRETARY || role === UserRole.ADMIN || role === UserRole.SUPERADMIN);
  });

  constructor(
    private processService: DegreeProcessService,
    private documentService: DocumentService,
    private reviewService: ReviewService,
    private authService: AuthService,
    private signatureService: SignatureService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.processId = params['id'];
      this.loadProcess();
    });
  }

  loadProcess(): void {
    this.loading.set(true);
    this.error.set(null);

    this.processService.getProcessById(this.processId).subscribe({
      next: (process) => {
        this.process.set(process);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading process:', err);
        this.error.set('Error al cargar el proceso. Intente de nuevo.');
        this.loading.set(false);
      }
    });
  }

  selectTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  // === PROCESS ACTIONS ===

  activateProcess(): void {
    if (this.actionInProgress()) return;
    this.actionInProgress.set(true);
    this.successMessage.set('');

    this.processService.activateProcess(this.processId).subscribe({
      next: (updated) => {
        this.process.set(updated);
        this.actionInProgress.set(false);
        this.successMessage.set('Proceso activado correctamente.');
      },
      error: (err) => {
        console.error('Error activating process:', err);
        this.error.set(err.error?.error || err.error?.message || 'Error al activar el proceso.');
        this.actionInProgress.set(false);
      }
    });
  }

  openAdvisorAssignment(): void {
    this.showAdvisorModal.set(true);
    this.processService.getAvailableAdvisors().subscribe({
      next: (advisors) => this.availableAdvisors.set(advisors),
      error: (err) => console.error('Error loading advisors:', err)
    });
  }

  closeAdvisorModal(): void {
    this.showAdvisorModal.set(false);
    this.selectedAdvisorId = '';
  }

  assignAdvisor(): void {
    if (!this.selectedAdvisorId || this.actionInProgress()) return;
    this.actionInProgress.set(true);

    this.processService.assignAdvisor(this.processId, this.selectedAdvisorId).subscribe({
      next: (updated) => {
        this.process.set(updated);
        this.actionInProgress.set(false);
        this.showAdvisorModal.set(false);
        this.selectedAdvisorId = '';
        this.successMessage.set('Asesor asignado correctamente.');
      },
      error: (err) => {
        console.error('Error assigning advisor:', err);
        this.error.set(err.error?.error || err.error?.message || 'Error al asignar asesor.');
        this.actionInProgress.set(false);
      }
    });
  }

  // === DOCUMENT ACTIONS ===

  onFileSelected(event: Event, requirementId: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    this.fileUploadInProgress.set(true);

    this.documentService.uploadDocument(requirementId, file).subscribe({
      next: () => {
        this.fileUploadInProgress.set(false);
        this.successMessage.set('Documento cargado correctamente.');
        this.loadProcess();
      },
      error: (err) => {
        console.error('Error uploading file:', err);
        this.error.set(err.error?.error || err.error?.message || 'Error al cargar el archivo.');
        this.fileUploadInProgress.set(false);
      }
    });
  }

  downloadDocument(documentVersionId: string, fileName: string): void {
    this.documentService.downloadDocument(documentVersionId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'documento';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => console.error('Error downloading:', err)
    });
  }

  downloadSignedDocument(requirementInstanceId: string, fileName: string): void {
    this.signatureService.downloadSignedDocument(requirementInstanceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName ? `firmado_${fileName}` : 'documento_firmado.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: (err) => {
        console.error('Error downloading signed document:', err);
        this.error.set('Error al descargar el documento firmado.');
      }
    });
  }

  isRequirementSigned(req: RequirementInstance): boolean {
    return req.status === DocumentStatus.FINALIZADO;
  }

  // === REVIEW ACTIONS (for Secretary) ===

  sendToReview(requirementInstanceId: string): void {
    if (this.actionInProgress()) return;
    this.actionInProgress.set(true);

    this.reviewService.sendToReview(requirementInstanceId).subscribe({
      next: () => {
        this.actionInProgress.set(false);
        this.successMessage.set('Documento enviado a revisión.');
        this.loadProcess();
      },
      error: (err) => {
        console.error('Error sending to review:', err);
        this.error.set(err.error?.error || err.error?.message || 'Error al enviar a revisión.');
        this.actionInProgress.set(false);
      }
    });
  }

  // === HELPER METHODS ===

  /**
   * Solo el ESTUDIANTE dueño del proceso puede cargar documentos.
   * Admin, Asesor y Secretario supervisan/aprueban, NO cargan documentos.
   */
  canUploadDocuments(): boolean {
    const proc = this.process();
    const role = this.userRole();
    const user = this.currentUser();
    if (!proc || !user) return false;

    // Solo el estudiante dueño puede cargar documentos
    if (role === UserRole.STUDENT) {
      const isOwner = proc.studentId === user.sub
        || proc.student?.id === user.sub;
      return isOwner
        && [ProcessStatus.DRAFT, ProcessStatus.ACTIVE, ProcessStatus.IN_REVIEW].includes(proc.status);
    }

    // Admin/Asesor/Secretario NO cargan documentos, solo supervisan
    return false;
  }

  canSendToReview(req: RequirementInstance): boolean {
    const role = this.userRole();
    const proc = this.process();
    if (!proc) return false;
    // El proceso debe estar ACTIVE o IN_REVIEW para poder enviar documentos a revisión
    const processAllowsReview = proc.status === ProcessStatus.ACTIVE || proc.status === ProcessStatus.IN_REVIEW;
    return (role === UserRole.SECRETARY || role === UserRole.ADMIN || role === UserRole.SUPERADMIN)
      && req.status === DocumentStatus.PENDIENTE
      && processAllowsReview;
  }

  /**
   * Verifica si el proceso NO está en un estado que permita enviar a revisión.
   * Útil para mostrar mensajes informativos a la secretaria.
   */
  isProcessNotActiveForReview(): boolean {
    const proc = this.process();
    if (!proc) return false;
    return proc.status !== ProcessStatus.ACTIVE && proc.status !== ProcessStatus.IN_REVIEW;
  }

  getStatusBadgeClass(status: ProcessStatus): string {
    const baseClass = 'status-badge';
    const statusClass: Record<ProcessStatus, string> = {
      [ProcessStatus.DRAFT]: `${baseClass} status-draft`,
      [ProcessStatus.ACTIVE]: `${baseClass} status-active`,
      [ProcessStatus.IN_REVIEW]: `${baseClass} status-review`,
      [ProcessStatus.APPROVED]: `${baseClass} status-approved`,
      [ProcessStatus.COMPLETED]: `${baseClass} status-completed`,
      [ProcessStatus.ARCHIVED]: `${baseClass} status-archived`
    };
    return statusClass[status] || baseClass;
  }

  getDocumentStatusClass(status: DocumentStatus): string {
    const baseClass = 'doc-status-badge';
    const statusClass: Record<DocumentStatus, string> = {
      [DocumentStatus.POR_CARGAR]: `${baseClass} status-pending`,
      [DocumentStatus.PENDIENTE]: `${baseClass} status-pending`,
      [DocumentStatus.EN_REVISION]: `${baseClass} status-review`,
      [DocumentStatus.EN_CORRECCION]: `${baseClass} status-correction`,
      [DocumentStatus.APROBADO]: `${baseClass} status-approved`,
      [DocumentStatus.FINALIZADO]: `${baseClass} status-final`
    };
    return statusClass[status] || baseClass;
  }

  getApprovalDecisionClass(decision: ApprovalDecision): string {
    const baseClass = 'approval-badge';
    const decisionClass: Record<ApprovalDecision, string> = {
      [ApprovalDecision.APPROVED]: `${baseClass} decision-approved`,
      [ApprovalDecision.REJECTED]: `${baseClass} decision-rejected`,
      [ApprovalDecision.REVISION_REQUESTED]: `${baseClass} decision-correction`
    };
    return decisionClass[decision] || baseClass;
  }

  /**
   * Obtiene todas las aprobaciones del proceso agrupadas por tipo.
   * Las aprobaciones vienen anidadas dentro de requirementInstances, no a nivel de proceso.
   */
  getApprovalsByType(type: ApprovalType): Approval[] {
    const proc = this.process();
    if (!proc?.requirementInstances) return [];
    const allApprovals: Approval[] = [];
    for (const ri of proc.requirementInstances) {
      if (ri.approvals) {
        allApprovals.push(...ri.approvals);
      }
    }
    return allApprovals.filter(a => a.type === type);
  }

  /**
   * Verifica si hay al menos una aprobación en todo el proceso (para mostrar la pestaña).
   */
  hasAnyApprovals(): boolean {
    const proc = this.process();
    if (!proc?.requirementInstances) return false;
    return proc.requirementInstances.some(ri => ri.approvals && ri.approvals.length > 0);
  }

  /**
   * Verifica si un RequirementInstance tiene aprobación académica (del asesor).
   */
  hasAcademicApproval(req: RequirementInstance): boolean {
    if (!req.approvals) return false;
    return req.approvals.some(
      a => a.type === ApprovalType.ACADEMIC && a.decision === ApprovalDecision.APPROVED
    );
  }

  /**
   * Verifica si un RequirementInstance tiene aprobación administrativa (de secretaría).
   */
  hasAdministrativeApproval(req: RequirementInstance): boolean {
    if (!req.approvals) return false;
    return req.approvals.some(
      a => a.type === ApprovalType.ADMINISTRATIVE && a.decision === ApprovalDecision.APPROVED
    );
  }

  /**
   * Obtiene las aprobaciones de un RequirementInstance específico.
   */
  getRequirementApprovals(req: RequirementInstance): Approval[] {
    return req.approvals || [];
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('es-CO', {
        year: 'numeric', month: 'long', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }
}
