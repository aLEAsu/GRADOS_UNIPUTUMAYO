import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import { DocumentStateMachine, DocumentStatus } from '../degree-process/domain/document-state-machine';
import { DocumentVersion, RequirementInstance, User } from '@prisma/client';

@Injectable()
export class DocumentsService {
  private logger = new Logger('DocumentsService');

  constructor(
    private prismaService: PrismaService,
    private storageService: StorageService,
    private configService: ConfigService,
  ) {}

  /**
   * Upload a document for a requirement instance
   */
  async uploadDocument(
    requirementInstanceId: string,
    file: Express.Multer.File,
    uploadedByUserId: string,
    comment?: string,
  ): Promise<DocumentVersion> {
    try {
      // Fetch requirement instance with related data
      const requirementInstance = await this.prismaService.requirementInstance.findUnique(
        {
          where: { id: requirementInstanceId },
          include: {
            degreeProcess: {
              include: { student: true },
            },
            modalityRequirement: {
              include: { documentType: true },
            },
            documentVersions: true,
          },
        },
      );

      if (!requirementInstance) {
        throw new NotFoundException('Requirement instance not found');
      }

      // Validate user is the student or authorized to upload
      const uploadedByUser = await this.prismaService.user.findUnique({
        where: { id: uploadedByUserId },
      });

      if (!uploadedByUser) {
        throw new NotFoundException('User not found');
      }

      // Only student can upload to their own process
      if (
        uploadedByUser.role === 'STUDENT' &&
        requirementInstance.degreeProcess.studentId !== uploadedByUserId
      ) {
        throw new ForbiddenException(
          'Only the student can upload documents to their process',
        );
      }

      // Validate file MIME type against DocumentType.acceptedMimeTypes
      const documentType = requirementInstance.modalityRequirement.documentType;
      if (
        !documentType.acceptedMimeTypes.includes(file.mimetype)
      ) {
        throw new BadRequestException(
          `File type ${file.mimetype} is not accepted for this document type. Allowed types: ${documentType.acceptedMimeTypes.join(', ')}`,
        );
      }

      // Validate file size against DocumentType.maxFileSizeMb
      const fileSizeMb = file.size / (1024 * 1024);
      if (fileSizeMb > documentType.maxFileSizeMb) {
        throw new BadRequestException(
          `File size (${fileSizeMb.toFixed(2)}MB) exceeds maximum allowed size of ${documentType.maxFileSizeMb}MB`,
        );
      }

      // Store file via StorageService
      const subPath = `requirement-instance/${requirementInstanceId}`;
      const uploadResult = await this.storageService.uploadFile(file, subPath);

      // Calculate next version number
      const versionNumber =
        requirementInstance.documentVersions.length > 0
          ? Math.max(...requirementInstance.documentVersions.map((v) => v.versionNumber)) + 1
          : 1;

      // Create DocumentVersion
      const documentVersion = await this.prismaService.documentVersion.create({
        data: {
          requirementInstanceId,
          versionNumber,
          fileName: uploadResult.storagePath.split('/').pop() || file.originalname,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          fileSizeByte: file.size,
          storagePath: uploadResult.storagePath,
          hashSha256: uploadResult.hashSha256,
          uploadedById: uploadedByUserId,
          uploadedAt: new Date(),
          comment: comment || null,
        },
        include: {
          uploadedBy: true,
          requirementInstance: true,
        },
      });

      // Transition RequirementInstance state based on current status
      const currentStatus = requirementInstance.status;
      let newStatus: DocumentStatus = currentStatus as unknown as DocumentStatus;

      // POR_CARGAR -> PENDIENTE (when student uploads first time)
      if (currentStatus === DocumentStatus.POR_CARGAR) {
        newStatus = DocumentStatus.PENDIENTE;
      }
      // EN_CORRECCION -> EN_REVISION (when student re-uploads after corrections requested)
      // Goes directly to EN_REVISION so the advisor sees it immediately without secretary intervention
      else if (currentStatus === DocumentStatus.EN_CORRECCION) {
        newStatus = DocumentStatus.EN_REVISION;
      }

      // Validate and perform state transition
      if (newStatus !== currentStatus) {
        DocumentStateMachine.validateTransition(
          currentStatus as unknown as DocumentStatus,
          newStatus,
          uploadedByUser.role,
        );

        await this.prismaService.requirementInstance.update({
          where: { id: requirementInstanceId },
          data: { status: newStatus },
        });
      }

      this.logger.log(
        `Document uploaded successfully: ${requirementInstanceId} (version ${versionNumber})`,
      );

      return documentVersion;
    } catch (error) {
      this.logger.error(
        `Failed to upload document for requirement ${requirementInstanceId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get all document versions for a requirement instance
   */
  async getDocumentVersions(
    requirementInstanceId: string,
    userId: string,
    userRole: string,
  ): Promise<DocumentVersion[]> {
    try {
      // Fetch requirement instance to check access
      const requirementInstance = await this.prismaService.requirementInstance.findUnique(
        {
          where: { id: requirementInstanceId },
          include: {
            degreeProcess: true,
          },
        },
      );

      if (!requirementInstance) {
        throw new NotFoundException('Requirement instance not found');
      }

      // Validate access permission
      this.validateRequirementAccess(
        requirementInstance.degreeProcess.studentId,
        userId,
        userRole,
      );

      // Get all versions
      const versions = await this.prismaService.documentVersion.findMany({
        where: { requirementInstanceId },
        include: {
          uploadedBy: true,
        },
        orderBy: { versionNumber: 'asc' },
      });

      return versions;
    } catch (error) {
      this.logger.error(
        `Failed to get document versions for requirement ${requirementInstanceId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get a specific document version
   */
  async getDocumentVersion(versionId: string): Promise<DocumentVersion | null> {
    try {
      const documentVersion = await this.prismaService.documentVersion.findUnique({
        where: { id: versionId },
        include: {
          uploadedBy: true,
          requirementInstance: true,
        },
      });

      if (!documentVersion) {
        throw new NotFoundException('Document version not found');
      }

      return documentVersion;
    } catch (error) {
      this.logger.error(
        `Failed to get document version ${versionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Download a document file
   */
  async downloadDocument(
    versionId: string,
    userId: string,
    userRole: string,
  ): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }> {
    try {
      const documentVersion = await this.prismaService.documentVersion.findUnique(
        {
          where: { id: versionId },
          include: {
            requirementInstance: {
              include: {
                degreeProcess: true,
              },
            },
          },
        },
      );

      if (!documentVersion) {
        throw new NotFoundException('Document version not found');
      }

      // Validate access permission
      this.validateRequirementAccess(
        documentVersion.requirementInstance.degreeProcess.studentId,
        userId,
        userRole,
      );

      // Retrieve file from storage
      const buffer = await this.storageService.getFile(
        documentVersion.storagePath,
      );

      this.logger.log(`Document downloaded: ${versionId}`);

      return {
        buffer,
        fileName: documentVersion.originalFileName,
        mimeType: documentVersion.mimeType,
      };
    } catch (error) {
      this.logger.error(
        `Failed to download document ${versionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Get all requirements for a degree process with their latest versions
   */
  async getRequirementsByProcess(
    processId: string,
    userId: string,
    userRole: string,
  ): Promise<
    Array<
      RequirementInstance & {
        modalityRequirement: any;
        documentVersions: DocumentVersion[];
      }
    >
  > {
    try {
      // Fetch degree process to validate access
      const degreeProcess = await this.prismaService.degreeProcess.findUnique({
        where: { id: processId },
      });

      if (!degreeProcess) {
        throw new NotFoundException('Degree process not found');
      }

      // Validate access permission
      this.validateRequirementAccess(degreeProcess.studentId, userId, userRole);

      // Get all requirements with their versions
      const requirements = await this.prismaService.requirementInstance.findMany(
        {
          where: { degreeProcessId: processId },
          include: {
            modalityRequirement: {
              include: {
                documentType: true,
                modality: true,
              },
            },
            documentVersions: {
              include: {
                uploadedBy: true,
              },
              orderBy: { versionNumber: 'desc' },
            },
          },
          orderBy: {
            modalityRequirement: {
              displayOrder: 'asc',
            },
          },
        },
      );

      return requirements;
    } catch (error) {
      this.logger.error(
        `Failed to get requirements for process ${processId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Delete a document version (only if in POR_CARGAR or PENDIENTE state and uploaded by user)
   */
  async deleteDocumentVersion(
    versionId: string,
    userId: string,
  ): Promise<void> {
    try {
      const documentVersion = await this.prismaService.documentVersion.findUnique(
        {
          where: { id: versionId },
          include: {
            requirementInstance: {
              include: {
                degreeProcess: true,
              },
            },
          },
        },
      );

      if (!documentVersion) {
        throw new NotFoundException('Document version not found');
      }

      // Only uploader can delete
      if (documentVersion.uploadedById !== userId) {
        throw new ForbiddenException('Only the uploader can delete this document');
      }

      // Only allow deletion in POR_CARGAR or PENDIENTE states
      const status = documentVersion.requirementInstance.status;
      if (
        status !== DocumentStatus.POR_CARGAR &&
        status !== DocumentStatus.PENDIENTE
      ) {
        throw new BadRequestException(
          `Cannot delete document in ${status} state. Only POR_CARGAR and PENDIENTE documents can be deleted.`,
        );
      }

      // Delete file from storage
      await this.storageService.deleteFile(documentVersion.storagePath);

      // Delete document version record
      await this.prismaService.documentVersion.delete({
        where: { id: versionId },
      });

      this.logger.log(`Document version deleted: ${versionId}`);
    } catch (error) {
      this.logger.error(
        `Failed to delete document version ${versionId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Helper: Validate access to a requirement instance
   */
  private validateRequirementAccess(
    processStudentId: string,
    userId: string,
    userRole: string,
  ): void {
    // Student can access their own process
    if (userRole === 'STUDENT' && processStudentId !== userId) {
      throw new ForbiddenException(
        'Students can only access their own degree process',
      );
    }

    // Advisors, Secretaries, and Admins can access all
    const allowedRoles = ['ADVISOR', 'SECRETARY', 'ADMIN', 'SUPERADMIN'];
    if (!allowedRoles.includes(userRole) && processStudentId !== userId) {
      throw new ForbiddenException('You do not have permission to access this requirement');
    }
  }
}
