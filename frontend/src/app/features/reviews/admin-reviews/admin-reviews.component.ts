import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApprovalDecision } from '../../../core/models/degree-process.model';
import { ReviewService } from '../../../core/services/review.service';
import { DocumentService } from '../../../core/services/document.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-reviews.component.html',
  styleUrl: './admin-reviews.component.css'
})
export class AdminReviewsComponent implements OnInit {
  reviews = signal<any[]>([]);
  loading = signal(true);
  error = signal('');
  searchTerm = '';
  processingId: string | null = null;
  observationTexts: Record<string, string> = {};
  validationErrors: Record<string, string> = {};
  expandedId: string | null = null;

  constructor(
    private reviewService: ReviewService,
    private documentService: DocumentService
  ) {}

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.loading.set(true);
    this.error.set('');

    this.reviewService.getPendingAdministrativeReviews().subscribe({
      next: (data) => {
        this.reviews.set(data.map(item => this.mapReviewItem(item)));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando revisiones administrativas:', err);
        this.error.set('Error al cargar las revisiones administrativas.');
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

  sendToReview(item: any): void {
    if (this.processingId) return;
    const reqId = item.requirementInstanceId || item.id;

    if (!item.documentVersionId) {
      this.validationErrors[item.id] = 'No hay una versión de documento disponible para enviar a revisión.';
      return;
    }

    const observations = (this.observationTexts[item.id] || '').trim() || 'Se solicita revisión administrativa.';
    this.processingId = reqId;

    this.reviewService.createAdministrativeApproval(reqId, {
      decision: ApprovalDecision.REVISION_REQUESTED,
      observations,
      documentVersionId: item.documentVersionId
    }).subscribe({
      next: () => {
        this.processingId = null;
        this.observationTexts[item.id] = '';
        this.loadReviews();
      },
      error: (err) => {
        console.error('Error enviando a revisión:', err);
        this.processingId = null;
      }
    });
  }

  approveAdministratively(item: any): void {
    if (this.processingId) return;
    const reqId = item.requirementInstanceId || item.id;
    if (!item.documentVersionId) {
      this.validationErrors[item.id] = 'No hay una version de documento disponible para revisar.';
      return;
    }
    this.processingId = reqId;

    this.reviewService.createAdministrativeApproval(reqId, {
      decision: ApprovalDecision.APPROVED,
      observations: this.observationTexts[item.id] || undefined,
      documentVersionId: item.documentVersionId
    }).subscribe({
      next: () => {
        this.processingId = null;
        this.loadReviews();
      },
      error: (err) => {
        console.error('Error en aprobación administrativa:', err);
        this.processingId = null;
      }
    });
  }

  rejectAdministratively(item: any): void {
    if (this.processingId) return;
    const comment = this.observationTexts[item.id];
    if (!comment?.trim()) {
      this.validationErrors[item.id] = 'Debes agregar una observación para rechazar.';
      return;
    }
    this.validationErrors[item.id] = '';
    const reqId = item.requirementInstanceId || item.id;
    if (!item.documentVersionId) {
      this.validationErrors[item.id] = 'No hay una version de documento disponible para revisar.';
      return;
    }
    this.processingId = reqId;

    this.reviewService.createAdministrativeApproval(reqId, {
      decision: ApprovalDecision.REJECTED,
      observations: comment,
      documentVersionId: item.documentVersionId
    }).subscribe({
      next: () => {
        this.processingId = null;
        this.observationTexts[item.id] = '';
        this.loadReviews();
      },
      error: (err) => {
        console.error('Error al rechazar administrativamente:', err);
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
      documentVersionId: latestDocument?.id,
      documentName: documentType?.name || latestDocument?.originalFileName || 'Documento',
      studentName: student ? `${student.firstName} ${student.lastName}` : '',
      processTitle: item.degreeProcess?.title || item.degreeProcess?.modality?.name || 'Proceso de grado',
      uploadDate: latestDocument?.uploadedAt || item.updatedAt || item.createdAt
    };
  }
}
