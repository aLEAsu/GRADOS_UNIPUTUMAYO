export enum DegreeModalityCode {
  THESIS = 'THESIS',
  INTERNSHIP = 'INTERNSHIP',
  RESEARCH_LINE = 'RESEARCH_LINE',
  DIPLOMA = 'DIPLOMA'
}

export enum ProcessStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED'
}

export enum DocumentStatus {
  POR_CARGAR = 'POR_CARGAR',
  PENDIENTE = 'PENDIENTE',
  EN_REVISION = 'EN_REVISION',
  EN_CORRECCION = 'EN_CORRECCION',
  APROBADO = 'APROBADO',
  FINALIZADO = 'FINALIZADO'
}

export enum ApprovalType {
  ACADEMIC = 'ACADEMIC',
  ADMINISTRATIVE = 'ADMINISTRATIVE'
}

export enum ApprovalDecision {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  REVISION_REQUESTED = 'REVISION_REQUESTED'
}

export interface ModalityResource {
  id: string;
  label: string;
  description?: string;
  originalFileName: string;
  mimeType: string;
  fileSizeByte: number;
  createdAt: string;
}

export interface DegreeModality {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  requirements?: ModalityRequirement[];
  resources?: ModalityResource[];
}

export interface ModalityRequirement {
  id: string;
  modalityId: string;
  documentTypeId: string;
  isRequired: boolean;
  displayOrder: number;
  instructions?: string;
  documentType?: DocumentType;
  existingFileName?: string | null;
}

export interface DocumentType {
  id: string;
  name: string;
  code: string;
  description: string;
  acceptedMimeTypes: string[];
  maxFileSizeMb: number;
  templateUrl?: string;
  isActive?: boolean;
}

export interface DegreeProcess {
  id: string;
  studentId: string;
  modalityId: string;
  advisorId?: string;
  title: string;
  description?: string;
  status: ProcessStatus;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  student?: import('./user.model').User;
  advisor?: import('./user.model').User;
  modality?: DegreeModality;
  requirementInstances?: RequirementInstance[];
  approvals?: Approval[];
}

export interface RequirementInstance {
  id: string;
  processId: string;
  requirementId: string;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  modalityRequirement?: ModalityRequirement;
  documentVersions?: DocumentVersion[];
  approvals?: Approval[];
}

export interface DocumentVersion {
  id: string;
  requirementInstanceId: string;
  versionNumber: number;
  fileName: string;
  originalFileName: string;
  mimeType: string;
  fileSizeByte: number;
  storagePath: string;
  hashSha256: string;
  uploadedById: string;
  uploadedAt: string;
  comment?: string;
  uploadedBy?: import('./user.model').User;
  observations?: Observation[];
  signatures?: DigitalSignature[];
}

export interface Approval {
  id: string;
  requirementInstanceId: string;
  documentVersionId: string;
  approverUserId: string;
  type: ApprovalType;
  decision: ApprovalDecision;
  observations?: string;
  approvedAt: string;
  approverUser?: import('./user.model').User;
  documentVersion?: DocumentVersion;
  requirementInstance?: { id: string; status: DocumentStatus };
}

export interface Observation {
  id: string;
  documentVersionId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author?: import('./user.model').User;
}

export interface DigitalSignature {
  id: string;
  documentVersionId: string;
  signerId: string;
  signatureData: string;
  certificateInfo: string;
  signedAt: string;
  isValid: boolean;
  signer?: import('./user.model').User;
}
