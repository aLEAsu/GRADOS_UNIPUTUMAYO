import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { DegreeProcessService } from '../../../core/services/degree-process.service';
import { DocumentService } from '../../../core/services/document.service';
import { DegreeModality, ModalityResource, ModalityRequirement } from '../../../core/models/degree-process.model';

interface ModalityCard {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  requirements: ModalityRequirement[];
  resources: ModalityResource[];
  resourceCount: number;
  hasResources: boolean;
}

// Default icons and descriptions for known modality codes
const MODALITY_DEFAULTS: Record<string, { icon: string; description: string }> = {
  THESIS: { icon: '📚', description: 'Proyecto de investigación original con defensa' },
  INTERNSHIP: { icon: '💼', description: 'Experiencia laboral supervisada' },
  RESEARCH_LINE: { icon: '🔬', description: 'Participación en proyecto de investigación' },
  DIPLOMA: { icon: '🎓', description: 'Programa de especialización' },
};

@Component({
  selector: 'app-process-new',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './process-new.component.html',
  styleUrl: './process-new.component.css'
})
export class ProcessNewComponent implements OnInit {
  currentStep = signal(1);
  loading = signal(false);
  error = signal<string | null>(null);
  success = signal(false);

  selectedModality = signal<string | null>(null);
  modalities = signal<DegreeModality[]>([]);
  resourceDownloadInProgress = signal<string | null>(null);

  form!: FormGroup;

  // Built dynamically from backend modalities
  selectedFilesByRequirementId = signal<Record<string, File | null>>({});
  selectedFileErrors = signal<Record<string, string>>({});

  modalityCards = computed<ModalityCard[]>(() => {
    return this.modalities().map(m => {
      const defaults = MODALITY_DEFAULTS[m.code] || { icon: '📄', description: m.description };
      const requirements = m.requirements || [];
      const resources = Array.from(
        new Map(
          (m.resources || []).map(resource => [resource.id, resource])
        ).values()
      );
      return {
        id: m.id,
        code: m.code,
        name: m.name,
        description: defaults.description || m.description,
        icon: defaults.icon,
        requirements,
        resources,
        resourceCount: resources.length,
        hasResources: resources.length > 0,
      };
    });
  });

  selectedModalityData = computed(() => {
    const code = this.selectedModality();
    return code ? this.modalityCards().find(m => m.code === code) : null;
  });

  selectedRequirements = computed<ModalityRequirement[]>(() => {
    return this.selectedModalityData()?.requirements ?? [];
  });

  selectedResources = computed<ModalityResource[]>(() => {
    return this.selectedModalityData()?.resources ?? [];
  });

  hasSelectedModalityResources = computed(() => {
    return this.selectedResources().length > 0;
  });

  canProceedToStep2 = computed(() => !!this.selectedModality());

  get canProceedToStep3(): boolean {
    return !!(this.form?.valid && this.selectedModality());
  }

  get canCreateProcess(): boolean {
    return !!this.form?.valid && !!this.selectedModality() && this.allRequiredDocsSelected();
  }

  get totalRequirementCount(): number {
    return this.selectedModalityData()?.requirements?.length ?? 0;
  }

  get requiredDocumentCount(): number {
    return this.selectedModalityData()?.requirements?.filter(req => req.isRequired).length ?? 0;
  }

  trackByCardCode(_index: number, card: ModalityCard): string {
    return card.code;
  }

  trackByRequirementId(_index: number, requirement: ModalityRequirement): string {
    return requirement.id;
  }

  trackByResourceId(_index: number, resource: ModalityResource): string {
    return resource.id;
  }

  downloadResource(modalityId: string, resourceId: string, fileName: string): void {
    if (this.resourceDownloadInProgress()) return;
    this.resourceDownloadInProgress.set(resourceId);

    this.processService.downloadModalityResource(modalityId, resourceId).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName || 'recurso.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
        this.resourceDownloadInProgress.set(null);
      },
      error: (err) => {
        console.error('Error downloading modality resource:', err);
        this.error.set('Error al descargar el archivo de la modalidad.');
        this.resourceDownloadInProgress.set(null);
      }
    });
  }

  constructor(
    private processService: DegreeProcessService,
    private documentService: DocumentService,
    private formBuilder: FormBuilder,
    public router: Router
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadModalities();
  }

  initForm(): void {
    this.form = this.formBuilder.group({
      title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
      description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(1000)]]
    });
  }

  loadModalities(): void {
    this.loading.set(true);
    this.processService.getModalities().subscribe({
      next: (modalities) => {
        this.modalities.set(modalities);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading modalities:', err);
        this.error.set('Error al cargar las modalidades');
        this.loading.set(false);
      }
    });
  }

  selectModality(code: string): void {
    this.selectedModality.set(code);
  }

  goToStep(step: number): void {
    if (step === 2 && !this.canProceedToStep2()) return;
    if (step === 3 && !this.canProceedToStep3) return;
    this.currentStep.set(step);
    this.error.set(null);
  }

  reviewRequirements(): void {
    if (!this.form.valid || !this.selectedModality()) {
      this.error.set('Por favor completa todos los campos requeridos antes de revisar.');
      return;
    }

    const requirementsCount = this.selectedModalityData()?.requirements.length ?? 0;
    if (requirementsCount === 0) {
      this.error.set('La modalidad seleccionada no tiene requisitos definidos.');
      return;
    }

    this.selectedFileErrors.set({});
    this.error.set(null);
    this.currentStep.set(3);
  }

  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.set(this.currentStep() - 1);
      this.error.set(null);
    }
  }

  getAcceptedMimeTypes(requirement: ModalityRequirement): string {
    const mimeTypes = requirement.documentType?.acceptedMimeTypes;
    return mimeTypes && mimeTypes.length > 0
      ? mimeTypes.join(',')
      : 'application/pdf,.pdf';
  }

  getMaxFileSizeMb(requirement: ModalityRequirement): number | null {
    return requirement.documentType?.maxFileSizeMb ?? null;
  }

  getFileValidationError(file: File, requirement: ModalityRequirement): string | null {
    const acceptedMimeTypes = requirement.documentType?.acceptedMimeTypes;
    if (acceptedMimeTypes && acceptedMimeTypes.length > 0) {
      const normalizedTypes = acceptedMimeTypes.map(type => type.trim().toLowerCase());
      const fileMime = file.type.toLowerCase();
      const extension = file.name.split('.').pop()?.toLowerCase() || '';

      const mimeValid = normalizedTypes.some(type => {
        if (type.startsWith('.')) {
          return extension === type.slice(1);
        }
        return fileMime === type || file.name.toLowerCase().endsWith(type);
      });

      if (!mimeValid) {
        return `Tipo de archivo inválido. Se permiten: ${normalizedTypes.join(', ')}`;
      }
    }

    const maxSizeMb = this.getMaxFileSizeMb(requirement);
    if (maxSizeMb !== null && maxSizeMb > 0) {
      const maxBytes = maxSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        return `El archivo excede el tamaño máximo de ${maxSizeMb} MB.`;
      }
    }

    return null;
  }

  onRequirementFileSelected(event: Event, requirementId: string): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    const requirement = this.selectedModalityData()?.requirements.find(req => req.id === requirementId);
    if (!requirement) {
      this.selectedFileErrors.set({
        ...this.selectedFileErrors(),
        [requirementId]: 'Requisito no encontrado para la carga de archivo.'
      });
      return;
    }

    const validationError = this.getFileValidationError(file, requirement);
    if (validationError) {
      this.selectedFileErrors.set({
        ...this.selectedFileErrors(),
        [requirementId]: validationError
      });
      input.value = '';
      return;
    }

    this.selectedFileErrors.set({
      ...this.selectedFileErrors(),
      [requirementId]: ''
    });
    this.selectedFilesByRequirementId.set({
      ...this.selectedFilesByRequirementId(),
      [requirementId]: file
    });
  }

  allRequiredDocsSelected(): boolean {
    const requirements = this.selectedModalityData()?.requirements || [];
    return requirements
      .filter(requirement => requirement.isRequired)
      .every(requirement => !!this.selectedFilesByRequirementId()[requirement.id]);
  }

  private async uploadSelectedFiles(processId: string, requirementInstances: any[]): Promise<void> {
    const requirements = this.selectedModalityData()?.requirements || [];
    const uploads: Promise<unknown>[] = [];

    for (const requirement of requirements.filter(req => req.isRequired)) {
      const file = this.selectedFilesByRequirementId()[requirement.id];
      if (!file) continue;

      const requirementInstance = requirementInstances.find(
        (ri: any) => ri.modalityRequirement?.id === requirement.id
      );
      if (!requirementInstance) {
        throw new Error(`No se encontró la instancia de requisito para ${requirement.documentType?.name || 'documento'}`);
      }

      uploads.push(lastValueFrom(this.documentService.uploadDocument(requirementInstance.id, file)));
    }

    await Promise.all(uploads);
  }

  async submitForm(): Promise<void> {
    if (!this.form.valid || !this.selectedModality()) {
      this.error.set('Por favor completa todos los campos requeridos');
      return;
    }

    if (!this.allRequiredDocsSelected()) {
      this.error.set('Debes seleccionar todos los documentos obligatorios antes de crear el proceso.');
      return;
    }

    const selectedCode = this.selectedModality();
    const matchedModality = this.modalities().find(m => m.code === selectedCode);

    if (!matchedModality) {
      this.error.set('Modalidad no encontrada. Por favor selecciona una modalidad válida.');
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(false);

    const payload = {
      modalityId: matchedModality.id,
      title: this.form.get('title')?.value,
      description: this.form.get('description')?.value
    };

    try {
      const process = await lastValueFrom(this.processService.createProcess(payload));
      await this.uploadSelectedFiles(process.id, process.requirementInstances || []);
      this.loading.set(false);
      this.success.set(true);
      setTimeout(() => {
        this.router.navigate(['/process', process.id]);
      }, 2000);
    } catch (err: any) {
      console.error('Error creating process or uploading archivos:', err);
      this.error.set(err?.error?.message || err?.message || 'Error al crear el proceso o subir documentos. Intente de nuevo.');
      this.loading.set(false);
    }
  }

  getFieldError(fieldName: string): string {
    const field = this.form.get(fieldName);
    if (!field?.errors || !field?.touched) return '';

    if (field.errors['required']) return 'Este campo es requerido';
    if (field.errors['minlength']) {
      const minLength = field.errors['minlength'].requiredLength;
      return `Mínimo ${minLength} caracteres`;
    }
    if (field.errors['maxlength']) {
      const maxLength = field.errors['maxlength'].requiredLength;
      return `Máximo ${maxLength} caracteres`;
    }

    return 'Campo inválido';
  }

  isFieldInvalid(fieldName: string): boolean {
    const field = this.form.get(fieldName);
    return !!(field && field.invalid && field.touched);
  }
}
