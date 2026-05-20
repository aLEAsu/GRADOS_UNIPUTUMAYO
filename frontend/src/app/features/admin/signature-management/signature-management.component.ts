import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SignatureService } from '../../../core/services/signature.service';
import { AdminService } from '../../../core/services/admin.service';

type TabType = 'images' | 'configs' | 'signing' | 'audit';

interface PositionPreset {
  label: string;
  description: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

@Component({
  selector: 'app-signature-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './signature-management.component.html',
  styleUrl: './signature-management.component.css',
})
export class SignatureManagementComponent implements OnInit {
  activeTab = signal<TabType>('images');
  loading = signal(false);
  error = signal('');
  successMessage = signal('');

  // Signature Images
  signatureImages = signal<any[]>([]);
  users = signal<any[]>([]);
  showImageModal = signal(false);
  selectedUserId = '';
  imageLabel = '';
  selectedFile: File | null = null;

  // Signature Configs
  signatureConfigs = signal<any[]>([]);
  documentTypes = signal<any[]>([]);
  showConfigModal = signal(false);
  selectedPreset = '';
  isCustomPosition = false;
  configForm = {
    documentTypeId: '',
    signerRole: '',
    signatureImageId: '',
    positionX: 72,
    positionY: 72,
    width: 150,
    height: 50,
    displayOrder: 0,
    label: '',
  };
  editingConfigId: string | null = null;

  // Process Signing
  processesReady = signal<any[]>([]);
  signingInProgress = signal<string | null>(null);
  signingReqInProgress = signal<string | null>(null);
  bulkSigningInProgress = signal(false);
  expandedProcessId = signal<string | null>(null);
  processSearch = '';

  // Pagination
  paginatedProcesses = signal<any[]>([]);
  pagination = signal({ page: 1, limit: 20, total: 0, pages: 0 });
  paginatedSearch = '';

  // Audit logs
  auditLogs = signal<any[]>([]);
  auditPagination = signal({ page: 1, limit: 20, total: 0, pages: 0 });

  // PDF Preview
  previewVisible = false;

  signerRoles = [
    { value: 'ADVISOR', label: 'Asesor' },
    { value: 'SECRETARY', label: 'Secretaria' },
    { value: 'ADMIN', label: 'Administrador / Director' },
  ];

  // Presets de posición para documentos institucionales (PDF A4: 595 x 842 pts)
  positionPresets: PositionPreset[] = [
    {
      label: 'Inferior Izquierda',
      description: 'Esquina inferior izquierda, ideal para primera firma',
      positionX: 60,
      positionY: 60,
      width: 150,
      height: 50,
    },
    {
      label: 'Inferior Centro',
      description: 'Centro inferior, ideal para firma principal',
      positionX: 222,
      positionY: 60,
      width: 150,
      height: 50,
    },
    {
      label: 'Inferior Derecha',
      description: 'Esquina inferior derecha, ideal para segunda firma',
      positionX: 385,
      positionY: 60,
      width: 150,
      height: 50,
    },
    {
      label: 'Centro Izquierda (Bajo)',
      description: 'Lado izquierdo a ~15% de altura',
      positionX: 60,
      positionY: 126,
      width: 150,
      height: 50,
    },
    {
      label: 'Centro Derecha (Bajo)',
      description: 'Lado derecho a ~15% de altura',
      positionX: 385,
      positionY: 126,
      width: 150,
      height: 50,
    },
  ];

  // Computed: filtered processes
  filteredProcesses = computed(() => {
    const search = this.processSearch.toLowerCase().trim();
    const processes = this.processesReady();
    if (!search) return processes;
    return processes.filter(
      (p) =>
        (p.student?.firstName + ' ' + p.student?.lastName).toLowerCase().includes(search) ||
        (p.modality?.name || '').toLowerCase().includes(search) ||
        (p.titleProject || '').toLowerCase().includes(search),
    );
  });

  // Computed: document types that need config
  unconfiguredDocTypes = computed(() => {
    const configs = this.signatureConfigs();
    const types = this.documentTypes();
    const configuredTypeIds = new Set(configs.map((c) => c.documentTypeId));
    return types.filter((t: any) => !configuredTypeIds.has(t.id));
  });

  // Computed: config completion status
  configCompletionStatus = computed(() => {
    const types = this.documentTypes();
    const configs = this.signatureConfigs();
    const configuredTypeIds = new Set(configs.map((c) => c.documentTypeId));
    return {
      total: types.length,
      configured: types.filter((t: any) => configuredTypeIds.has(t.id)).length,
      pending: types.filter((t: any) => !configuredTypeIds.has(t.id)).length,
    };
  });

  constructor(
    private signatureService: SignatureService,
    private adminService: AdminService,
  ) {}

  ngOnInit(): void {
    this.loadImages();
    this.loadConfigs();
    this.loadProcessesReady();
    this.loadUsers();
    this.loadDocumentTypes();
  }

  selectTab(tab: TabType): void {
    this.activeTab.set(tab);
    this.error.set('');
    this.successMessage.set('');

    if (tab === 'audit' && this.auditLogs().length === 0) {
      this.loadAuditLogs();
    }
  }

  // =============================================
  // SIGNATURE IMAGES TAB
  // =============================================

  loadImages(): void {
    this.signatureService.getAllSignatureImages().subscribe({
      next: (images) => this.signatureImages.set(images),
      error: (err) => console.error('Error loading images:', err),
    });
  }

  loadUsers(): void {
    this.adminService.getUsers({ limit: 100 }).subscribe({
      next: (res) => {
        this.users.set(
          (res.data || (res as any)).filter((u: any) => u.role !== 'STUDENT'),
        );
      },
      error: (err) => console.error('Error loading users:', err),
    });
  }

  openImageModal(): void {
    this.selectedUserId = '';
    this.imageLabel = '';
    this.selectedFile = null;
    this.showImageModal.set(true);
  }

  closeImageModal(): void {
    this.showImageModal.set(false);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.selectedFile = input.files[0];
    }
  }

  saveSignatureImage(): void {
    if (!this.selectedUserId || !this.imageLabel || !this.selectedFile) return;
    this.loading.set(true);

    this.signatureService
      .createSignatureImage(this.selectedUserId, this.imageLabel, this.selectedFile)
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.showImageModal.set(false);
          this.successMessage.set('Imagen de firma creada correctamente.');
          this.loadImages();
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err.error?.error || err.error?.message || 'Error al crear imagen de firma.');
        },
      });
  }

  deleteImage(id: string): void {
    if (!confirm('¿Está seguro de eliminar esta imagen de firma?')) return;
    this.signatureService.deleteSignatureImage(id).subscribe({
      next: () => {
        this.successMessage.set('Imagen de firma eliminada.');
        this.loadImages();
      },
      error: (err) => this.error.set(err.error?.error || 'Error al eliminar imagen de firma.'),
    });
  }

  getImageUrl(id: string): string {
    return this.signatureService.getSignatureImageFileUrl(id);
  }

  getUsersWithoutSignature(): any[] {
    const existingUserIds = this.signatureImages().map((img) => img.userId);
    return this.users().filter((u) => !existingUserIds.includes(u.id));
  }

  getRoleLabelForUser(role: string): string {
    const labels: Record<string, string> = {
      ADVISOR: 'Asesor',
      SECRETARY: 'Secretaria',
      ADMIN: 'Administrador',
      SUPERADMIN: 'Super Admin',
    };
    return labels[role] || role;
  }

  // =============================================
  // SIGNATURE CONFIGS TAB
  // =============================================

  loadConfigs(): void {
    this.signatureService.getAllSignatureConfigs().subscribe({
      next: (configs) => this.signatureConfigs.set(configs),
      error: (err) => console.error('Error loading configs:', err),
    });
  }

  loadDocumentTypes(): void {
    this.adminService.getDocumentTypes().subscribe({
      next: (types) => this.documentTypes.set(types),
      error: (err) => console.error('Error loading document types:', err),
    });
  }

  openConfigModal(existing?: any): void {
    if (existing) {
      this.editingConfigId = existing.id;
      this.configForm = {
        documentTypeId: existing.documentTypeId,
        signerRole: existing.signerRole,
        signatureImageId: existing.signatureImageId || '',
        positionX: existing.positionX,
        positionY: existing.positionY,
        width: existing.width,
        height: existing.height,
        displayOrder: existing.displayOrder,
        label: existing.label,
      };
      this.isCustomPosition = true;
      this.selectedPreset = '';
    } else {
      this.editingConfigId = null;
      this.configForm = {
        documentTypeId: '',
        signerRole: '',
        signatureImageId: '',
        positionX: 72,
        positionY: 72,
        width: 150,
        height: 50,
        displayOrder: 0,
        label: '',
      };
      this.isCustomPosition = false;
      this.selectedPreset = '';
    }
    this.showConfigModal.set(true);
  }

  closeConfigModal(): void {
    this.showConfigModal.set(false);
    this.editingConfigId = null;
  }

  onPresetChange(): void {
    if (this.selectedPreset === 'custom') {
      this.isCustomPosition = true;
      return;
    }
    this.isCustomPosition = false;
    const preset = this.positionPresets.find((p) => p.label === this.selectedPreset);
    if (preset) {
      this.configForm.positionX = preset.positionX;
      this.configForm.positionY = preset.positionY;
      this.configForm.width = preset.width;
      this.configForm.height = preset.height;
    }
  }

  onRoleChange(): void {
    const role = this.signerRoles.find((r) => r.value === this.configForm.signerRole);
    if (role && !this.configForm.label) {
      this.configForm.label = `Firma ${role.label}`;
    }
    // Auto-assign image if there's one for this role
    const roleImages = this.signatureImages().filter(
      (img) => img.user?.role === this.configForm.signerRole,
    );
    if (roleImages.length === 1 && !this.configForm.signatureImageId) {
      this.configForm.signatureImageId = roleImages[0].id;
    }
  }

  saveConfig(): void {
    this.loading.set(true);

    const data = {
      ...this.configForm,
      signatureImageId: this.configForm.signatureImageId || undefined,
      positionX: Number(this.configForm.positionX),
      positionY: Number(this.configForm.positionY),
      width: Number(this.configForm.width),
      height: Number(this.configForm.height),
      displayOrder: Number(this.configForm.displayOrder),
    };

    const obs$ = this.editingConfigId
      ? this.signatureService.updateSignatureConfig(this.editingConfigId, data)
      : this.signatureService.createSignatureConfig(data);

    obs$.subscribe({
      next: () => {
        this.loading.set(false);
        this.showConfigModal.set(false);
        this.successMessage.set(
          this.editingConfigId
            ? 'Configuración actualizada correctamente.'
            : 'Configuración creada correctamente.',
        );
        this.loadConfigs();
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error || err.error?.message || 'Error al guardar configuración.');
      },
    });
  }

  deleteConfig(id: string): void {
    if (!confirm('¿Está seguro de eliminar esta configuración?')) return;
    this.signatureService.deleteSignatureConfig(id).subscribe({
      next: () => {
        this.successMessage.set('Configuración eliminada.');
        this.loadConfigs();
      },
      error: (err) => this.error.set(err.error?.error || 'Error al eliminar configuración.'),
    });
  }

  getRoleLabel(role: string): string {
    return this.signerRoles.find((r) => r.value === role)?.label || role;
  }

  getConfigsByDocType(): Map<string, any[]> {
    const grouped = new Map<string, any[]>();
    for (const config of this.signatureConfigs()) {
      const key = config.documentType?.name || 'Sin tipo';
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(config);
    }
    return grouped;
  }

  // =============================================
  // PROCESS SIGNING TAB
  // =============================================

  loadProcessesReady(): void {
    this.signatureService.getProcessesReadyForSigning().subscribe({
      next: (processes) => this.processesReady.set(processes),
      error: (err) => console.error('Error loading processes:', err),
    });
  }

  toggleProcess(processId: string): void {
    this.expandedProcessId.set(
      this.expandedProcessId() === processId ? null : processId,
    );
  }

  signProcess(processId: string): void {
    if (this.signingInProgress()) return;
    if (
      !confirm(
        '¿Firmar TODOS los documentos de este proceso? Esta acción es irreversible.',
      )
    )
      return;

    this.signingInProgress.set(processId);
    this.error.set('');

    this.signatureService.signProcess(processId).subscribe({
      next: (result) => {
        this.signingInProgress.set(null);
        this.successMessage.set(
          `Proceso firmado: ${result.signedDocuments}/${result.totalDocuments} documentos. Estado: ${result.processStatus}`,
        );
        this.loadProcessesReady();
      },
      error: (err) => {
        this.signingInProgress.set(null);
        this.error.set(err.error?.error || err.error?.message || 'Error al firmar el proceso.');
      },
    });
  }

  signSingleRequirement(processId: string, reqId: string): void {
    if (this.signingReqInProgress()) return;

    this.signingReqInProgress.set(reqId);
    this.error.set('');

    this.signatureService.signSingleRequirement(processId, reqId).subscribe({
      next: (result) => {
        this.signingReqInProgress.set(null);
        this.successMessage.set(
          result.processCompleted
            ? 'Documento firmado. Proceso completado.'
            : 'Documento firmado correctamente.',
        );
        this.loadProcessesReady();
      },
      error: (err) => {
        this.signingReqInProgress.set(null);
        this.error.set(err.error?.error || err.error?.message || 'Error al firmar documento.');
      },
    });
  }

  signAllProcesses(): void {
    if (this.bulkSigningInProgress()) return;
    const count = this.processesReady().length;
    if (
      !confirm(
        `¿Firmar TODOS los documentos de ${count} proceso(s)? Esta acción es irreversible y puede tardar varios minutos.`,
      )
    )
      return;

    this.bulkSigningInProgress.set(true);
    this.error.set('');

    this.signatureService.signAllReadyProcesses().subscribe({
      next: (result) => {
        this.bulkSigningInProgress.set(false);
        this.successMessage.set(
          `Firma masiva completada: ${result.signedProcesses}/${result.totalProcesses} procesos firmados.` +
            (result.failedProcesses > 0
              ? ` ${result.failedProcesses} fallaron.`
              : ''),
        );
        if (result.errors?.length > 0) {
          console.warn('Errores en firma masiva:', result.errors);
        }
        this.loadProcessesReady();
      },
      error: (err) => {
        this.bulkSigningInProgress.set(false);
        this.error.set(err.error?.error || err.error?.message || 'Error en firma masiva.');
      },
    });
  }

  getProcessRequirementsCount(process: any): {
    total: number;
    approved: number;
    signed: number;
  } {
    const reqs = process.requirementInstances || [];
    return {
      total: reqs.length,
      approved: reqs.filter((r: any) => r.status === 'APROBADO').length,
      signed: reqs.filter((r: any) => r.status === 'FINALIZADO' || r.digitalSignatures?.length > 0).length,
    };
  }

  hasAllConfigsForProcess(process: any): boolean {
    const reqs = (process.requirementInstances || []).filter(
      (r: any) => r.status === 'APROBADO',
    );
    return reqs.every(
      (r: any) => r.modalityRequirement?.documentType?.signatureConfigs?.length > 0,
    );
  }

  getUnconfiguredDocsForProcess(process: any): string[] {
    return (process.requirementInstances || [])
      .filter(
        (r: any) =>
          r.status === 'APROBADO' &&
          (!r.modalityRequirement?.documentType?.signatureConfigs ||
            r.modalityRequirement?.documentType?.signatureConfigs?.length === 0),
      )
      .map((r: any) => r.modalityRequirement?.documentType?.name || 'Desconocido');
  }

  hasConfigForRequirement(req: any): boolean {
    return (req.modalityRequirement?.documentType?.signatureConfigs?.length || 0) > 0;
  }

  canSignAnyProcess(): boolean {
    return this.processesReady().some((p) => this.hasAllConfigsForProcess(p));
  }

  // =============================================
  // PAGINATED PROCESSES
  // =============================================

  loadProcessesPaginated(page = 1): void {
    this.signatureService.getProcessesReadyPaginated({
      page,
      limit: this.pagination().limit,
      search: this.paginatedSearch || undefined,
    }).subscribe({
      next: (res) => {
        this.paginatedProcesses.set(res.data);
        this.pagination.set(res.pagination);
      },
      error: (err) => console.error('Error loading paginated processes:', err),
    });
  }

  onPaginatedSearch(): void {
    this.loadProcessesPaginated(1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pagination().pages) return;
    this.loadProcessesPaginated(page);
  }

  // =============================================
  // AUDIT LOGS
  // =============================================

  loadAuditLogs(page = 1): void {
    this.signatureService.getAuditLogs({ page, limit: 20 }).subscribe({
      next: (res) => {
        this.auditLogs.set(res.data);
        this.auditPagination.set(res.pagination);
      },
      error: (err) => console.error('Error loading audit logs:', err),
    });
  }

  goToAuditPage(page: number): void {
    if (page < 1 || page > this.auditPagination().pages) return;
    this.loadAuditLogs(page);
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      SIGN_PROCESS: 'Firmó proceso',
      SIGN_SINGLE_REQUIREMENT: 'Firmó documento',
      UNSIGN_REQUIREMENT: 'Revirtió firma',
      ARCHIVE_PROCESS: 'Archivó proceso',
      BULK_ARCHIVE: 'Archivado masivo',
    };
    return labels[action] || action;
  }

  // =============================================
  // UNSIGN / REVERT
  // =============================================

  unsignRequirement(processId: string, reqId: string, docName: string): void {
    if (!confirm(`¿Revertir la firma del documento "${docName}"? Se eliminarán las firmas digitales y el PDF firmado.`)) return;

    this.signingReqInProgress.set(reqId);
    this.error.set('');

    this.signatureService.unsignRequirement(processId, reqId).subscribe({
      next: (result) => {
        this.signingReqInProgress.set(null);
        this.successMessage.set(result.message || 'Firma revertida correctamente.');
        this.loadProcessesReady();
      },
      error: (err) => {
        this.signingReqInProgress.set(null);
        this.error.set(err.error?.error || err.error?.message || 'Error al revertir firma.');
      },
    });
  }

  // =============================================
  // ARCHIVE
  // =============================================

  archiveProcess(processId: string): void {
    if (!confirm('¿Archivar este proceso? Esta acción es irreversible.')) return;

    this.signatureService.archiveProcess(processId).subscribe({
      next: () => {
        this.successMessage.set('Proceso archivado correctamente.');
        this.loadProcessesReady();
      },
      error: (err) => this.error.set(err.error?.error || 'Error al archivar proceso.'),
    });
  }

  // =============================================
  // PDF PREVIEW (A4 proportional preview)
  // =============================================

  getPreviewStyle(): { left: string; bottom: string; width: string; height: string } {
    // A4 PDF dimensions: 595 x 842 pts
    // Preview container: 297 x 421 px (50% scale)
    const scaleX = 297 / 595;
    const scaleY = 421 / 842;

    return {
      left: `${this.configForm.positionX * scaleX}px`,
      bottom: `${this.configForm.positionY * scaleY}px`,
      width: `${this.configForm.width * scaleX}px`,
      height: `${this.configForm.height * scaleY}px`,
    };
  }

}
