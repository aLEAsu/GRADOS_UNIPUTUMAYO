import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApprovalDecision } from '../../../core/models/degree-process.model';
import { ReviewService } from '../../../core/services/review.service';
import { AuthService } from '../../../core/services/auth.service';
import { DocumentService } from '../../../core/services/document.service';

@Component({
  selector: 'app-pending-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './pending-reviews.component.html',
  styleUrl: './pending-reviews.component.css'
})
export class PendingReviewsComponent implements OnInit {
  reviews = signal<any[]>([]);
  loading = signal(true);
  error = signal('');
  searchTerm = '';
  processingId: string | null = null;
  observationTexts: Record<string, string> = {};
  validationErrors: Record<string, string> = {};
  actionErrors: Record<string, string> = {};
  expandedId: string | null = null;

  constructor(
    private reviewService: ReviewService,
    private documentService: DocumentService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.loading.set(true);
    this.error.set('');

    this.reviewService.getPendingAcademicReviews().subscribe({
      next: (data) => {
        const user = this.authService.currentUser();
        const userId = user?.sub;

        const mapped = data.map(item => this.mapReviewItem(item));

        // Filtrar items que YA fueron aprobados por el asesor actual
        // SOLO para la versión más reciente del documento (no versiones anteriores)
        const filtered = mapped.filter((it: any) => {
          if (!userId) return true;
          const latestDocVersionId = it.documentVersionId;
          if (!latestDocVersionId) return true;
          const approvals = it.approvals || [];
          return !approvals.some((a: any) => {
            const approverId = a?.approverUser?.id || a?.approver?.id || a?.approverUserId;
            const decision = a?.decision;
            const approvalDocVersionId = a?.documentVersionId || a?.documentVersion?.id;
            // Solo filtrar si la aprobación es para la versión ACTUAL del documento
            return approverId === userId
              && decision === ApprovalDecision.APPROVED
              && approvalDocVersionId === latestDocVersionId;
          });
        });

        this.reviews.set(filtered);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando revisiones:', err);
        this.error.set('Error al cargar las revisiones pendientes.');
        this.loading.set(false);
      }
    });
  }

  get filteredReviews(): any[] {
    if (!this.searchTerm) return this.reviews();
    const term = this.searchTerm.toLowerCase();
    return this.reviews().filter((r: any) =>
      (r.title || '').toLowerCase().includes(term) ||
      (r.studentName || '').toLowerCase().includes(term) ||
      (r.documentName || '').toLowerCase().includes(term)
    );
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
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
      error: (err) => console.error('Error descargando:', err)
    });
  }

  private mapApiError(err: any): string {
    const error = err.error?.error || err.message || '';
    const details = err.error?.details || {};

    // Log full error for debugging
    console.log('Full API Error:', { error, details, message: err.message, status: err.status });

    // Map specific backend error messages
    if (error.includes('Validation failed')) {
      return 'Validación fallida. Intenta de nuevo.';
    }
    if (error.includes('not found') || error.includes('no encontrado')) {
      return 'El documento o requisito no fue encontrado.';
    }
    if (error.includes('not in EN_REVISION status') || error.includes('EN_REVISION')) {
      return 'El documento no está en estado de revisión. Debe estar en estado "En Revisión" para aprobarlo.';
    }
    if (error.includes('Current status:')) {
      const statusMatch = error.match(/Current status: (\w+)/);
      if (statusMatch) {
        return `El documento está en estado "${statusMatch[1]}" y no se puede aprobar. Debe estar en estado "EN_REVISION".`;
      }
    }
    if (error.includes('not assigned') || error.includes('assigned') || error.includes('permission') || error.includes('ASSIGNED_ADVISOR')) {
      return 'No estás asignado como asesor en este proceso. Contacta con administración.';
    }
    if (error.includes('Insufficient')) {
      return 'Permisos insuficientes para esta acción.';
    }

    // Generic fallback
    return `Error al procesar: ${error || 'Error desconocido'}. Intenta de nuevo.`;
  }

  approve(item: any): void {
    if (this.processingId) return;
    const reqId = item.requirementInstanceId || item.id;
    if (!item.documentVersionId) {
      this.actionErrors[item.id] = 'No hay una version de documento disponible para revisar.';
      return;
    }
    this.processingId = reqId;
    this.actionErrors[item.id] = '';
    
    console.log('Aprobando documento:', { reqId, documentVersionId: item.documentVersionId });

    this.reviewService.createAcademicApproval(reqId, {
      decision: ApprovalDecision.APPROVED,
      observations: this.observationTexts[item.id] || undefined,
      documentVersionId: item.documentVersionId
    }).subscribe({
      next: () => {
        console.log('Aprobación exitosa');
        this.processingId = null;
        this.actionErrors[item.id] = '';
        this.observationTexts[item.id] = '';
        this.loadReviews();
      },
      error: (err) => {
        console.error('Error al aprobar:', err);
        this.actionErrors[item.id] = this.mapApiError(err);
        this.processingId = null;
      }
    });
  }

  requestCorrection(item: any): void {
    if (this.processingId) return;
    const comment = this.observationTexts[item.id];
    if (!comment?.trim()) {
      this.validationErrors[item.id] = 'Debes agregar una observación antes de solicitar corrección.';
      return;
    }
    this.validationErrors[item.id] = '';
    const reqId = item.requirementInstanceId || item.id;
    if (!item.documentVersionId) {
      this.validationErrors[item.id] = 'No hay una version de documento disponible para revisar.';
      return;
    }
    this.processingId = reqId;

    this.reviewService.createAcademicApproval(reqId, {
      decision: ApprovalDecision.REVISION_REQUESTED,
      observations: comment,
      documentVersionId: item.documentVersionId
    }).subscribe({
      next: () => {
        this.processingId = null;
        this.observationTexts[item.id] = '';
        this.validationErrors[item.id] = '';
        this.loadReviews();
      },
      error: (err) => {
        console.error('Error al solicitar corrección:', err);
        this.validationErrors[item.id] = this.mapApiError(err);
        this.processingId = null;
      }
    });
  }

  reject(item: any): void {
    if (this.processingId) return;
    const comment = this.observationTexts[item.id];
    if (!comment?.trim()) {
      this.validationErrors[item.id] = 'Debes agregar una observación para rechazar el documento.';
      return;
    }
    this.validationErrors[item.id] = '';
    const reqId = item.requirementInstanceId || item.id;
    if (!item.documentVersionId) {
      this.validationErrors[item.id] = 'No hay una version de documento disponible para revisar.';
      return;
    }
    this.processingId = reqId;

    this.reviewService.createAcademicApproval(reqId, {
      decision: ApprovalDecision.REJECTED,
      observations: comment,
      documentVersionId: item.documentVersionId
    }).subscribe({
      next: () => {
        this.processingId = null;
        this.observationTexts[item.id] = '';
        this.validationErrors[item.id] = '';
        this.loadReviews();
      },
      error: (err) => {
        console.error('Error al rechazar:', err);
        this.validationErrors[item.id] = this.mapApiError(err);
        this.processingId = null;
      }
    });
  }

  addObservation(item: any): void {
    const text = this.observationTexts[item.id];
    const reqId = item.requirementInstanceId || item.id;
    if (!text?.trim()) return;

    this.reviewService.addObservation(reqId, {
      content: text,
      documentVersionId: item.documentVersionId
    }).subscribe({
      next: () => {
        this.observationTexts[item.id] = '';
      },
      error: (err) => console.error('Error al agregar observación:', err)
    });
  }

  private mapReviewItem(item: any): any {
    const latestDocument = item.documentVersions?.[0];
    const student = item.degreeProcess?.student;
    const documentType = item.modalityRequirement?.documentType;

    return {
      ...item,
      requirementInstanceId: item.id,
      processId: item.degreeProcess?.id,
      documentVersionId: latestDocument?.id,
      documentName: documentType?.name || latestDocument?.originalFileName || 'Documento',
      studentName: student ? `${student.firstName} ${student.lastName}` : '',
      processTitle: item.degreeProcess?.title || item.degreeProcess?.modality?.name || 'Proceso de grado',
      uploadDate: latestDocument?.uploadedAt || item.updatedAt || item.createdAt
    };
  }
}
