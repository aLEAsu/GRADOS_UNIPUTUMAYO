import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DegreeModality, DocumentType } from '../../../core/models/degree-process.model';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-modality-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './modality-management.component.html',
  styleUrl: './modality-management.component.css'
})
export class ModalityManagementComponent implements OnInit {
  modalities = signal<DegreeModality[]>([]);
  documentTypes = signal<DocumentType[]>([]);
  loading = signal(true);
  error = signal('');
  successMsg = signal('');
  searchTerm = '';
  expandedId: string | null = null;


  // Create/Edit modality
  showCreateModal = signal(false);
  editingModality = signal<DegreeModality | null>(null);
  modalityForm = { name: '', code: '', description: '', isActive: true };
  saving = signal(false);

  // Add/edit requirement
  showRequirementModal = signal(false);
  targetModalityId = '';
  requirementForm = { documentTypeId: '', documentTypeName: '', isRequired: true, displayOrder: 1, instructions: '' };
  requirementFile: File | null = null;
  requirementFileName = '';
  requirementExistingFileName = '';
  editingRequirementId: string | null = null;

  constructor(private adminService: AdminService) {}

  ngOnInit(): void {
    this.loadModalities();
    this.loadDocumentTypes();
  }

  loadModalities(): void {
    this.loading.set(true);
    this.error.set('');

    this.adminService.getModalities().subscribe({
      next: (data) => {
        this.modalities.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error cargando modalidades:', err);
        this.error.set('Error al cargar las modalidades.');
        this.loading.set(false);
      }
    });
  }

  loadDocumentTypes(): void {
    this.adminService.getDocumentTypes().subscribe({
      next: (data) => this.documentTypes.set(data),
      error: (err) => console.error('Error cargando tipos de documento:', err)
    });
  }

  get filteredModalities(): DegreeModality[] {
    if (!this.searchTerm) return this.modalities();
    const term = this.searchTerm.toLowerCase();
    return this.modalities().filter(m =>
      m.name.toLowerCase().includes(term) ||
      m.description.toLowerCase().includes(term)
    );
  }

  toggleExpand(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  // === CREATE/EDIT MODALITY ===

  openCreateModal(): void {
    this.editingModality.set(null);
    this.modalityForm = { name: '', code: '', description: '', isActive: true };
    this.showCreateModal.set(true);
  }

  openEditModal(modality: DegreeModality): void {
    this.editingModality.set(modality);
    this.modalityForm = {
      name: modality.name,
      code: modality.code,
      description: modality.description,
      isActive: modality.isActive
    };
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.editingModality.set(null);
  }

  saveModality(): void {
    if (!this.modalityForm.name || !this.modalityForm.code) {
      this.error.set('Nombre y código son obligatorios.');
      return;
    }

    this.saving.set(true);
    const editing = this.editingModality();

    if (editing) {
      this.adminService.updateModality(editing.id, this.modalityForm as any).subscribe({
        next: () => {
          this.saving.set(false);
          this.showCreateModal.set(false);
          this.successMsg.set('Modalidad actualizada correctamente.');
          this.loadModalities();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err.error?.message || 'Error al actualizar la modalidad.');
        }
      });
    } else {
      this.adminService.createModality(this.modalityForm as any).subscribe({
        next: () => {
          this.saving.set(false);
          this.showCreateModal.set(false);
          this.successMsg.set('Modalidad creada correctamente.');
          this.loadModalities();
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err.error?.message || 'Error al crear la modalidad.');
        }
      });
    }
  }

  // === REQUIREMENTS ===

  openAddRequirement(modalityId: string): void {
    this.editingRequirementId = null;
    this.targetModalityId = modalityId;
    const modality = this.modalities().find((m) => m.id === modalityId);
    const nextOrder = modality?.requirements?.length ? modality.requirements.length + 1 : 1;
    this.requirementForm = {
      documentTypeId: '',
      documentTypeName: '',
      isRequired: true,
      displayOrder: nextOrder,
      instructions: '',
    };
    this.requirementFile = null;
    this.requirementFileName = '';
    this.error.set('');
    this.showRequirementModal.set(true);
  }

  openEditRequirement(modalityId: string, requirement: any): void {
    this.editingRequirementId = requirement.id;
    this.targetModalityId = modalityId;
    this.requirementForm = {
      documentTypeId: requirement.documentTypeId,
      documentTypeName: '',
      isRequired: requirement.isRequired,
      displayOrder: requirement.displayOrder,
      instructions: requirement.instructions || '',
    };
    this.requirementFile = null;
    this.requirementFileName = '';
    this.requirementExistingFileName = requirement.existingFileName || '';
    this.error.set('');
    this.showRequirementModal.set(true);
  }

  closeRequirementModal(): void {
    this.showRequirementModal.set(false);
    this.targetModalityId = '';
    this.editingRequirementId = null;
    this.requirementFile = null;
    this.requirementFileName = '';
    this.requirementExistingFileName = '';
    this.error.set('');
  }

  onRequirementFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] || null;
    this.requirementFile = file;
    this.requirementFileName = file?.name || '';
  }

  addRequirement(): void {
    if (!this.requirementForm.documentTypeId && !this.requirementForm.documentTypeName?.trim()) {
      this.error.set('Selecciona o ingresa un tipo de documento.');
      return;
    }

    const payload = new FormData();
    if (this.requirementForm.documentTypeId) {
      payload.append('documentTypeId', this.requirementForm.documentTypeId);
    }
    if (this.requirementForm.documentTypeName?.trim()) {
      payload.append('documentTypeName', this.requirementForm.documentTypeName.trim());
    }
    payload.append('isRequired', String(this.requirementForm.isRequired));
    payload.append('displayOrder', String(this.requirementForm.displayOrder));
    payload.append('instructions', this.requirementForm.instructions || '');
    if (this.requirementFile) {
      payload.append('file', this.requirementFile, this.requirementFile.name);
    }

    this.saving.set(true);
    const request$ = this.editingRequirementId
      ? this.adminService.updateRequirement(this.targetModalityId, this.editingRequirementId, payload)
      : this.adminService.addRequirementToModality(this.targetModalityId, payload);

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.showRequirementModal.set(false);
        this.successMsg.set(this.editingRequirementId ? 'Requisito actualizado correctamente.' : 'Requisito agregado correctamente.');
        this.editingRequirementId = null;
        this.loadModalities();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.error?.message || (this.editingRequirementId ? 'Error al actualizar el requisito.' : 'Error al agregar el requisito.'));
      }
    });
  }

  removeRequirement(modalityId: string, requirementId: string): void {
    if (!confirm('¿Estás seguro de eliminar este requisito?')) return;

    this.adminService.removeRequirementFromModality(modalityId, requirementId).subscribe({
      next: () => {
        this.successMsg.set('Requisito eliminado.');
        this.loadModalities();
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Error al eliminar el requisito.');
      }
    });
  }

  // === HELPERS ===

  getModalityIcon(code: string): string {
    const icons: Record<string, string> = {
      THESIS: 'pi pi-book',
      INTERNSHIP: 'pi pi-briefcase',
      RESEARCH_LINE: 'pi pi-search',
      DIPLOMA: 'pi pi-id-card',
    };
    return icons[code] || 'pi pi-file';
  }

  getModalityColor(code: string): string {
    const colors: Record<string, string> = {
      THESIS: 'modality-thesis',
      INTERNSHIP: 'modality-internship',
      RESEARCH_LINE: 'modality-research',
      DIPLOMA: 'modality-diploma',
    };
    return colors[code] || '';
  }
}
