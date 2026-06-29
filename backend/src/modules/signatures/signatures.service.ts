/* signatures.service.ts */
import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PDFDocument, rgb } from 'pdf-lib';
import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';
import * as QRCode from 'qrcode';
import * as crypto from 'crypto';
import {
  ApprovalDecision,
  ApprovalType,
  DocumentStatus,
  ProcessStatus,
  UserRole,
  NotificationType,
} from '@prisma/client';
import {
  CreateSignatureImageDto,
  UpdateSignatureImageDto,
  CreateSignatureConfigDto,
  UpdateSignatureConfigDto,
} from './dto/sign-document.dto';

export interface SignatureVerification {
  isValid: boolean;
  details: {
    signedBy: string;
    timestamp: string;
    documentHash: string;
  };
}

export interface CertificateInfo {
  serial: string;
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
}

export interface KeyPairGenerationResult {
  certificateInfo: CertificateInfo;
  message: string;
}

export interface SignProcessResult {
  processId: string;
  signedDocuments: number;
  totalDocuments: number;
  signatures: any[];
  processStatus: string;
}

@Injectable()
export class SignaturesService {
  private logger = new Logger('SignaturesService');

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private storageService: StorageService,
    private notificationsService: NotificationsService,
  ) {}

  // =============================================
  // SIGNATURE IMAGE MANAGEMENT (Admin uploads)
  // =============================================

  /**
   * Upload a signature image for a user
   * Only ADMIN/SUPERADMIN can upload
   */
  async createSignatureImage(
    dto: CreateSignatureImageDto,
    file: Express.Multer.File,
    uploadedByUserId: string,
  ) {
    // Validate the target user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Check if user already has a signature image
    const existing = await this.prisma.signatureImage.findUnique({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new BadRequestException(
        'Este usuario ya tiene una imagen de firma. Use la actualización para reemplazarla.',
      );
    }

    // Validate file is an image (PNG preferred for transparency)
    const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedMimes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}. Use PNG, JPEG o WebP.`,
      );
    }

    // Store the signature image
    const subPath = `signatures/${dto.userId}`;
    const uploadResult = await this.storageService.uploadFile(file, subPath);

    const signatureImage = await this.prisma.signatureImage.create({
      data: {
        userId: dto.userId,
        imagePath: uploadResult.storagePath,
        originalFileName: file.originalname,
        label: dto.label,
        uploadedById: uploadedByUserId,
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });

    this.logger.log(`Signature image created for user ${dto.userId}`);
    return signatureImage;
  }

  /**
   * Update signature image (replace image or update label)
   */
  async updateSignatureImage(id: string, dto: UpdateSignatureImageDto, file?: Express.Multer.File) {
    const existing = await this.prisma.signatureImage.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Imagen de firma no encontrada');
    }

    const updateData: any = {};
    if (dto.label !== undefined) updateData.label = dto.label;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    // Replace image file if provided
    if (file) {
      const allowedMimes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowedMimes.includes(file.mimetype)) {
        throw new BadRequestException(
          `Tipo de archivo no permitido: ${file.mimetype}. Use PNG, JPEG o WebP.`,
        );
      }

      // Delete old file
      try {
        await this.storageService.deleteFile(existing.imagePath);
      } catch (e) {
        this.logger.warn(`Could not delete old signature image: ${e.message}`);
      }

      // Upload new file
      const subPath = `signatures/${existing.userId}`;
      const uploadResult = await this.storageService.uploadFile(file, subPath);
      updateData.imagePath = uploadResult.storagePath;
      updateData.originalFileName = file.originalname;
    }

    return this.prisma.signatureImage.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });
  }

  /**
   * Get all signature images
   */
  async getAllSignatureImages() {
    return this.prisma.signatureImage.findMany({
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get signature image by ID
   */
  async getSignatureImageById(id: string) {
    const image = await this.prisma.signatureImage.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        },
      },
    });
    if (!image) {
      throw new NotFoundException('Imagen de firma no encontrada');
    }
    return image;
  }

  /**
   * Delete a signature image
   */
  async deleteSignatureImage(id: string) {
    const existing = await this.prisma.signatureImage.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException('Imagen de firma no encontrada');
    }

    // Delete file from storage
    try {
      await this.storageService.deleteFile(existing.imagePath);
    } catch (e) {
      this.logger.warn(`Could not delete signature image file: ${e.message}`);
    }

    await this.prisma.signatureImage.delete({ where: { id } });
    return { message: 'Imagen de firma eliminada correctamente' };
  }

  /**
   * Download signature image file
   */
  async getSignatureImageFile(
    id: string,
  ): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const image = await this.prisma.signatureImage.findUnique({ where: { id } });
    if (!image) {
      throw new NotFoundException('Imagen de firma no encontrada');
    }

    const buffer = await this.storageService.getFile(image.imagePath);
    const ext = path.extname(image.originalFileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
    };

    return {
      buffer,
      fileName: image.originalFileName,
      mimeType: mimeMap[ext] || 'image/png',
    };
  }

  // =============================================
  // SIGNATURE CONFIG MANAGEMENT
  // =============================================

  /**
   * Create a signature config for a document type
   */
  async createSignatureConfig(dto: CreateSignatureConfigDto) {
    // Validate document type exists
    const docType = await this.prisma.documentType.findUnique({
      where: { id: dto.documentTypeId },
    });
    if (!docType) {
      throw new NotFoundException('Tipo de documento no encontrado');
    }

    // Validate signature image if provided
    if (dto.signatureImageId) {
      const image = await this.prisma.signatureImage.findUnique({
        where: { id: dto.signatureImageId },
      });
      if (!image) {
        throw new NotFoundException('Imagen de firma no encontrada');
      }
    }

    return this.prisma.signatureConfig.create({
      data: {
        documentTypeId: dto.documentTypeId,
        signerRole: dto.signerRole,
        signatureImageId: dto.signatureImageId || null,
        positionX: dto.positionX,
        positionY: dto.positionY,
        width: dto.width || 150,
        height: dto.height || 60,
        displayOrder: dto.displayOrder || 0,
        label: dto.label,
      },
      include: {
        documentType: { select: { id: true, name: true, code: true } },
        signatureImage: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
    });
  }

  /**
   * Update a signature config
   */
  async updateSignatureConfig(id: string, dto: UpdateSignatureConfigDto) {
    const existing = await this.prisma.signatureConfig.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Configuración de firma no encontrada');
    }

    if (dto.signatureImageId) {
      const image = await this.prisma.signatureImage.findUnique({
        where: { id: dto.signatureImageId },
      });
      if (!image) {
        throw new NotFoundException('Imagen de firma no encontrada');
      }
    }

    return this.prisma.signatureConfig.update({
      where: { id },
      data: {
        ...(dto.signatureImageId !== undefined && { signatureImageId: dto.signatureImageId }),
        ...(dto.positionX !== undefined && { positionX: dto.positionX }),
        ...(dto.positionY !== undefined && { positionY: dto.positionY }),
        ...(dto.width !== undefined && { width: dto.width }),
        ...(dto.height !== undefined && { height: dto.height }),
        ...(dto.displayOrder !== undefined && { displayOrder: dto.displayOrder }),
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        documentType: { select: { id: true, name: true, code: true } },
        signatureImage: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
    });
  }

  /**
   * Get all signature configs
   */
  async getAllSignatureConfigs() {
    return this.prisma.signatureConfig.findMany({
      include: {
        documentType: { select: { id: true, name: true, code: true } },
        signatureImage: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
      orderBy: [{ documentType: { name: 'asc' } }, { displayOrder: 'asc' }],
    });
  }

  /**
   * Get signature configs by document type
   */
  async getSignatureConfigsByDocumentType(documentTypeId: string) {
    return this.prisma.signatureConfig.findMany({
      where: { documentTypeId, isActive: true },
      include: {
        documentType: { select: { id: true, name: true, code: true } },
        signatureImage: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, role: true } },
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });
  }

  /**
   * Delete a signature config
   */
  async deleteSignatureConfig(id: string) {
    const existing = await this.prisma.signatureConfig.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Configuración de firma no encontrada');
    }
    await this.prisma.signatureConfig.delete({ where: { id } });
    return { message: 'Configuración de firma eliminada correctamente' };
  }

  // =============================================
  // PROCESS SIGNING (BULK - Main Feature)
  // =============================================

  /**
   * Get all processes ready for signing (status APPROVED)
   */
  async getProcessesReadyForSigning() {
    return this.prisma.degreeProcess.findMany({
      where: { status: ProcessStatus.APPROVED },
      include: {
        student: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        advisor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        modality: { select: { id: true, name: true, code: true } },
        requirementInstances: {
          include: {
            modalityRequirement: {
              include: { documentType: { include: { signatureConfigs: true } } },
            },
            documentVersions: {
              orderBy: { uploadedAt: 'desc' },
              take: 1,
            },
            digitalSignatures: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Sign ALL documents in a process
   * This is the main action: iterates all requirementInstances,
   * applies visual signatures to the PDF based on SignatureConfig,
   * records DigitalSignature entries, and transitions to FINALIZADO/COMPLETED
   */
  async signProcess(
    processId: string,
    signedByUserId: string,
    ipAddress?: string,
  ): Promise<SignProcessResult> {
    this.logger.log(`Starting bulk signing for process: ${processId}`);

    // Validate user
    const user = await this.prisma.user.findUnique({ where: { id: signedByUserId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Solo ADMIN o SUPERADMIN pueden firmar procesos');
    }

    // Load process with all details
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
      include: {
        advisor: { select: { id: true, firstName: true, lastName: true } },
        student: { select: { id: true, firstName: true, lastName: true } },
        requirementInstances: {
          include: {
            modalityRequirement: {
              include: {
                documentType: {
                  include: {
                    signatureConfigs: {
                      where: { isActive: true },
                      include: {
                        signatureImage: true,
                      },
                      orderBy: { displayOrder: 'asc' },
                    },
                  },
                },
              },
            },
            documentVersions: {
              orderBy: { uploadedAt: 'desc' },
              take: 1,
            },
            approvals: true,
            digitalSignatures: true,
          },
        },
      },
    });

    if (!process) throw new NotFoundException('Proceso no encontrado');
    if (process.status !== ProcessStatus.APPROVED) {
      throw new BadRequestException(
        `El proceso debe estar en estado APPROVED para firmar. Estado actual: ${process.status}`,
      );
    }

    // VALIDACIÓN CRÍTICA: Verificar que TODOS los documentos APROBADOS tengan configuración de firma
    const unconfiguredTypes = process.requirementInstances
      .filter((ri) => ri.status === DocumentStatus.APROBADO)
      .filter(
        (ri) =>
          !ri.modalityRequirement.documentType.signatureConfigs ||
          ri.modalityRequirement.documentType.signatureConfigs.length === 0,
      )
      .map((ri) => ri.modalityRequirement.documentType.name);

    if (unconfiguredTypes.length > 0) {
      throw new BadRequestException(
        `No se puede firmar: los siguientes tipos de documento no tienen configuración de firma: ${unconfiguredTypes.join(', ')}. Configure las posiciones de firma antes de proceder.`,
      );
    }

    const signatures: any[] = [];
    let signedCount = 0;

    // Process each requirement instance
    for (const reqInstance of process.requirementInstances) {
      // Skip if already signed (FINALIZADO)
      if (reqInstance.status === DocumentStatus.FINALIZADO) {
        this.logger.debug(`Skipping already finalized requirement: ${reqInstance.id}`);
        continue;
      }

      // Must be APROBADO to sign
      if (reqInstance.status !== DocumentStatus.APROBADO) {
        this.logger.warn(
          `Requirement ${reqInstance.id} is not APROBADO (status: ${reqInstance.status}), skipping`,
        );
        continue;
      }

      // Get latest document version
      const latestVersion = reqInstance.documentVersions[0];
      if (!latestVersion) {
        this.logger.warn(`No document version for requirement ${reqInstance.id}, skipping`);
        continue;
      }

      // Get signature configs for this document type
      const signatureConfigs = reqInstance.modalityRequirement.documentType.signatureConfigs;
      if (!signatureConfigs || signatureConfigs.length === 0) {
        this.logger.warn(
          `No signature config for document type ${reqInstance.modalityRequirement.documentType.code}, signing without visual stamps`,
        );
      }

      // Apply visual signatures + QR to the PDF
      const signedPdfResult = await this.applyVisualSignaturesToPdf(
        latestVersion.storagePath,
        signatureConfigs,
        process.advisor,
        reqInstance.id,
      );

      // Create digital signature records for each signer config
      const signatureRecords = await this.prisma.$transaction(async (tx) => {
        const records = [];

        // Save the signed PDF
        const signedDocPath = signedPdfResult.storagePath;

        for (const config of signatureConfigs) {
          const record = await tx.digitalSignature.create({
            data: {
              requirementInstanceId: reqInstance.id,
              documentVersionId: latestVersion.id,
              signedById: signedByUserId,
              signatureImageId: config.signatureImageId || null,
              signatureHash: signedPdfResult.hash,
              signedDocumentPath: signedDocPath,
              timestamp: new Date(),
              metadata: {
                algorithm: 'VISUAL-PDF-STAMP',
                signerRole: config.signerRole,
                signerLabel: config.label,
                positionX: config.positionX,
                positionY: config.positionY,
              },
            },
            include: {
              signedBy: {
                select: { id: true, firstName: true, lastName: true },
              },
            },
          });
          records.push(record);
        }

        // Nota: Ya no se permite firmar sin configuraciones.
        // La validación al inicio del método garantiza que siempre hay configs.

        // Transition requirement to FINALIZADO
        await tx.requirementInstance.update({
          where: { id: reqInstance.id },
          data: { status: DocumentStatus.FINALIZADO },
        });

        return records;
      });

      signatures.push(...signatureRecords);
      signedCount++;
    }

    // Transition process to COMPLETED if all requirements are FINALIZADO
    const updatedProcess = await this.prisma.$transaction(async (tx) => {
      const freshProcess = await tx.degreeProcess.findUnique({
        where: { id: processId },
        include: { requirementInstances: { select: { status: true } } },
      });

      const allFinalized = freshProcess!.requirementInstances.every(
        (r) => r.status === DocumentStatus.FINALIZADO,
      );

      if (allFinalized) {
        return tx.degreeProcess.update({
          where: { id: processId },
          data: {
            status: ProcessStatus.COMPLETED,
            completedAt: new Date(),
          },
        });
      }

      return freshProcess;
    });

    this.logger.log(
      `Process ${processId} signing completed: ${signedCount}/${process.requirementInstances.length} documents signed`,
    );

    // Audit logging
    await this.logAuditEvent({
      userId: signedByUserId,
      action: 'SIGN_PROCESS',
      entity: 'DegreeProcess',
      entityId: processId,
      ipAddress,
      details: {
        signedDocuments: signedCount,
        totalDocuments: process.requirementInstances.length,
        processStatus: updatedProcess!.status,
      },
    });

    // Notify student via email + in-app notification
    await this.notifyStudentProcessSigned(process, signedCount);

    return {
      processId,
      signedDocuments: signedCount,
      totalDocuments: process.requirementInstances.length,
      signatures,
      processStatus: updatedProcess!.status,
    };
  }

  /**
   * Sign a SINGLE requirement instance within a process
   */
  async signSingleRequirement(
    processId: string,
    requirementInstanceId: string,
    signedByUserId: string,
    ipAddress?: string,
  ) {
    this.logger.log(`Signing single requirement ${requirementInstanceId} in process ${processId}`);

    const user = await this.prisma.user.findUnique({ where: { id: signedByUserId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Solo ADMIN o SUPERADMIN pueden firmar documentos');
    }

    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
      include: {
        advisor: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!process) throw new NotFoundException('Proceso no encontrado');
    if (process.status !== ProcessStatus.APPROVED) {
      throw new BadRequestException(
        `El proceso debe estar APPROVED para firmar. Estado actual: ${process.status}`,
      );
    }

    const reqInstance = await this.prisma.requirementInstance.findUnique({
      where: { id: requirementInstanceId },
      include: {
        modalityRequirement: {
          include: {
            documentType: {
              include: {
                signatureConfigs: {
                  where: { isActive: true },
                  include: { signatureImage: true },
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
        },
        documentVersions: { orderBy: { uploadedAt: 'desc' }, take: 1 },
        digitalSignatures: true,
      },
    });

    if (!reqInstance) throw new NotFoundException('Requisito no encontrado');
    if (reqInstance.degreeProcessId !== processId) {
      throw new BadRequestException('El requisito no pertenece a este proceso');
    }
    if (reqInstance.status === DocumentStatus.FINALIZADO) {
      throw new BadRequestException('Este documento ya está firmado');
    }
    if (reqInstance.status !== DocumentStatus.APROBADO) {
      throw new BadRequestException(
        `El documento debe estar APROBADO para firmar. Estado actual: ${reqInstance.status}`,
      );
    }

    const signatureConfigs = reqInstance.modalityRequirement.documentType.signatureConfigs;
    if (!signatureConfigs || signatureConfigs.length === 0) {
      throw new BadRequestException(
        `El tipo de documento "${reqInstance.modalityRequirement.documentType.name}" no tiene configuración de firma. Configúrelo primero.`,
      );
    }

    const latestVersion = reqInstance.documentVersions[0];
    if (!latestVersion) {
      throw new BadRequestException('No hay versión de documento para firmar');
    }

    const signedPdfResult = await this.applyVisualSignaturesToPdf(
      latestVersion.storagePath,
      signatureConfigs,
      process.advisor,
      requirementInstanceId,
    );

    const signatureRecords = await this.prisma.$transaction(async (tx) => {
      const records = [];
      const signedDocPath = signedPdfResult.storagePath;

      for (const config of signatureConfigs) {
        const record = await tx.digitalSignature.create({
          data: {
            requirementInstanceId: reqInstance.id,
            documentVersionId: latestVersion.id,
            signedById: signedByUserId,
            signatureImageId: config.signatureImageId || null,
            signatureHash: signedPdfResult.hash,
            signedDocumentPath: signedDocPath,
            timestamp: new Date(),
            metadata: {
              algorithm: 'VISUAL-PDF-STAMP',
              signerRole: config.signerRole,
              signerLabel: config.label,
              positionX: config.positionX,
              positionY: config.positionY,
            },
          },
        });
        records.push(record);
      }

      await tx.requirementInstance.update({
        where: { id: reqInstance.id },
        data: { status: DocumentStatus.FINALIZADO },
      });

      return records;
    });

    // Check if ALL requirements are now FINALIZADO to transition process
    const freshProcess = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
      include: { requirementInstances: { select: { status: true } } },
    });
    const allFinalized = freshProcess!.requirementInstances.every(
      (r) => r.status === DocumentStatus.FINALIZADO,
    );
    if (allFinalized) {
      await this.prisma.degreeProcess.update({
        where: { id: processId },
        data: { status: ProcessStatus.COMPLETED, completedAt: new Date() },
      });
    }

    // Audit logging
    await this.logAuditEvent({
      userId: signedByUserId,
      action: 'SIGN_SINGLE_REQUIREMENT',
      entity: 'RequirementInstance',
      entityId: requirementInstanceId,
      ipAddress,
      details: {
        processId,
        documentType: reqInstance.modalityRequirement.documentType.name,
        processCompleted: allFinalized,
      },
    });

    // Notify student if process is now completed
    if (allFinalized) {
      const fullProcess = await this.prisma.degreeProcess.findUnique({
        where: { id: processId },
        include: { student: true, modality: true, requirementInstances: true },
      });
      if (fullProcess) {
        await this.notifyStudentProcessSigned(fullProcess, fullProcess.requirementInstances.length);
      }
    }

    return {
      requirementInstanceId,
      signedDocuments: 1,
      signatures: signatureRecords,
      processCompleted: allFinalized,
    };
  }

  /**
   * Sign ALL ready processes (bulk operation for 2000+ students)
   */
  async signAllReadyProcesses(signedByUserId: string, ipAddress?: string) {
    const readyProcesses = await this.getProcessesReadyForSigning();

    if (readyProcesses.length === 0) {
      return { totalProcesses: 0, signedProcesses: 0, errors: [] };
    }

    const results: {
      processId: string;
      success: boolean;
      error?: string;
      result?: SignProcessResult;
    }[] = [];

    for (const process of readyProcesses) {
      try {
        const result = await this.signProcess(process.id, signedByUserId, ipAddress);
        results.push({ processId: process.id, success: true, result });
      } catch (error) {
        results.push({
          processId: process.id,
          success: false,
          error: error.message || 'Error desconocido',
        });
      }
    }

    return {
      totalProcesses: readyProcesses.length,
      signedProcesses: results.filter((r) => r.success).length,
      failedProcesses: results.filter((r) => !r.success).length,
      errors: results
        .filter((r) => !r.success)
        .map((r) => ({
          processId: r.processId,
          error: r.error,
        })),
    };
  }

  /**
   * Validate that a process has all signature configs ready
   */
  async validateProcessConfigs(processId: string) {
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
      include: {
        requirementInstances: {
          include: {
            modalityRequirement: {
              include: {
                documentType: {
                  include: { signatureConfigs: { where: { isActive: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!process) throw new NotFoundException('Proceso no encontrado');

    const requirements = process.requirementInstances.map((ri) => {
      const configs = ri.modalityRequirement.documentType.signatureConfigs || [];
      return {
        requirementInstanceId: ri.id,
        documentTypeName: ri.modalityRequirement.documentType.name,
        documentTypeId: ri.modalityRequirement.documentType.id,
        status: ri.status,
        hasConfigs: configs.length > 0,
        configCount: configs.length,
      };
    });

    const unconfigured = requirements.filter((r) => !r.hasConfigs && r.status === 'APROBADO');
    return {
      processId,
      isReady: unconfigured.length === 0,
      totalRequirements: requirements.length,
      unconfiguredRequirements: unconfigured,
      requirements,
    };
  }

  /**
   * Apply visual signature images onto a PDF using pdf-lib
   * Reads the original PDF, inserts signature images on the last page,
   * saves to a new file, and returns the path + hash
   */
  private async applyVisualSignaturesToPdf(
    storagePath: string,
    signatureConfigs: any[],
    advisor: any,
    requirementInstanceId: string,
  ): Promise<{ storagePath: string; hash: string }> {
    // 1. Obtener el PDF original
    const originalBuffer = await this.storageService.getFile(storagePath);
    if (!originalBuffer || originalBuffer.length === 0) {
      throw new NotFoundException('El documento original no se encontró o está vacío');
    }

    const pdfDoc = await PDFDocument.load(originalBuffer);

    // 2. Determinar pagina objetivo (ultima por defecto)
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const {width: pageWidth, height: pageHeight} = lastPage.getSize();

    // 3. Insertar cada firma según su configuración
    for (const config of signatureConfigs) {
      try{
        if (config.signatureImage && config.signatureImage.imagePath) {
        const imgBuffer: Buffer = await this.storageService.getFile(config.signatureImage.imagePath);
        
        // Detectar tipo por extension o por buffer 
        const ext = path.extname(config.signatureImage.originalFileName || config.signatureImage.imagePath).toLowerCase();
        let embeddedImage;
        if(ext === '.png' || ext === '.webp'){
          embeddedImage = await pdfDoc.embedPng(imgBuffer);
        }else{
          //jpg/jpeg
          embeddedImage = await pdfDoc.embedJpg(imgBuffer);
        }

        const x = config.positionX;
        const y = config.positionY;

        lastPage.drawImage(embeddedImage, {
          x,
          y,
          width: config.width || 150,
          height: config.height || 60,
        });
      }

      // Añadir un QR con datos de verificación (solo si config.qr === true o siempre)
      const qrData = `req:${requirementInstanceId};role:${config.signerRole};label:${config.label}`;
      const qrBuffer = await QRCode.toBuffer(qrData, { type: 'png', margin: 1, width: 200 });
      const qrImage = await pdfDoc.embedPng(qrBuffer);

      // Colocar QR a la derecha de la firma si cabe, sino en esquina inferior derecha
      const qrX = Math.min((config.positionX || 0) + (config.width || 150) + 10, pageWidth - 60);
      const qrY = Math.max((config.positionY || 0), 10);

      lastPage.drawImage(qrImage, {
        x: qrX,
        y: qrY, 
        width: 50,
        height: 50,
      });
    } catch(err){
      this.logger.warn(`Error al insertar la firma para la configuracion ${config.id || config.label}: ${err.message}`);
      // No abortar todo: lanzar para que el caller decida o continuar según política.
      throw new BadRequestException(`Error al aplicar firma visual: ${err.message}`);
    }
  }

    // 4. Guardar el nuevo PDF
    const signedPdfBytes = await pdfDoc.save();
    const newPath = `signed/${requirementInstanceId}/${Date.now()}.pdf`;
    // asegurarse de que storageService.saveFile acepte buffer 
    await this.storageService.saveFile(newPath, Buffer.from(signedPdfBytes));

    // 5. Calcular hash SHA-256 
    const hash = crypto.createHash('sha256').update(signedPdfBytes).digest('hex');

    return { storagePath: newPath, hash};
  }

  // SIGNED DOCUMENT DOWNLOAD
  /**
   * Download a signed document by requirement instance ID
   */
  async downloadSignedDocument(requirementInstanceId: string): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  }> {
    // Find the latest signature with a signed document path
    const signature = await this.prisma.digitalSignature.findFirst({
      where: {
        requirementInstanceId,
        signedDocumentPath: { not: null },
      },
      include: {
        documentVersion: true,
        requirementInstance: {
          include: {
            modalityRequirement: {
              include: { documentType: true },
            },
          },
        },
      },
      orderBy: { timestamp: 'desc' },
    });

    if (!signature || !signature.signedDocumentPath) {
      throw new NotFoundException('No se encontró documento firmado para este requisito');
    }

    const buffer = await this.storageService.getFile(signature.signedDocumentPath);
    const docTypeName = signature.requirementInstance.modalityRequirement.documentType.name;
    const fileName = `${docTypeName}_firmado.pdf`;

    return {
      buffer,
      fileName,
      mimeType: 'application/pdf',
    };
  }

  // =============================================
  // EXISTING METHODS (kept for backward compatibility)
  // =============================================

  /**
   * Sign a single document (legacy method)
   */
  async signDocument(
    requirementInstanceId: string,
    documentVersionId: string,
    signedByUserId: string,
  ) {
    this.logger.debug(
      `Attempting to sign document: requirementInstanceId=${requirementInstanceId}, documentVersionId=${documentVersionId}`,
    );

    const user = await this.prisma.user.findUnique({
      where: { id: signedByUserId },
    });

    if (!user) throw new NotFoundException('User not found');

    if (
      user.role !== UserRole.SECRETARY &&
      user.role !== UserRole.ADMIN &&
      user.role !== UserRole.SUPERADMIN
    ) {
      throw new ForbiddenException('Only SECRETARY or ADMIN users can sign documents');
    }

    const requirementInstance = await this.prisma.requirementInstance.findUnique({
      where: { id: requirementInstanceId },
      include: {
        documentVersions: true,
        approvals: true,
      },
    });

    if (!requirementInstance) throw new NotFoundException('Requirement instance not found');

    const documentVersion = await this.prisma.documentVersion.findUnique({
      where: { id: documentVersionId },
    });

    if (!documentVersion) throw new NotFoundException('Document version not found');

    if (documentVersion.requirementInstanceId !== requirementInstanceId) {
      throw new BadRequestException(
        'Document version does not belong to this requirement instance',
      );
    }

    // Validate approvals
    const academicApproval = await this.prisma.approval.findFirst({
      where: {
        requirementInstanceId,
        type: ApprovalType.ACADEMIC,
        decision: ApprovalDecision.APPROVED,
      },
    });

    const administrativeApproval = await this.prisma.approval.findFirst({
      where: {
        requirementInstanceId,
        type: ApprovalType.ADMINISTRATIVE,
        decision: ApprovalDecision.APPROVED,
      },
    });

    if (!academicApproval) {
      throw new BadRequestException('Academic approval not found or not approved');
    }
    if (!administrativeApproval) {
      throw new BadRequestException('Administrative approval not found or not approved');
    }

    const allowedStatuses: DocumentStatus[] = [DocumentStatus.APROBADO, DocumentStatus.EN_REVISION];
    if (!allowedStatuses.includes(requirementInstance.status as DocumentStatus)) {
      throw new BadRequestException(
        `Document must be in APROBADO or EN_REVISION status to sign. Current status: ${requirementInstance.status}`,
      );
    }

    try {
      const documentBuffer = await this.storageService.getFile(documentVersion.storagePath);

      const md = forge.md.sha256.create();
      md.update(documentBuffer.toString('binary'));
      const documentHash = md.digest().toHex();

      const privateKeyPath = this.configService.get<string>('signatures.privateKeyPath');

      if (!privateKeyPath || !fs.existsSync(privateKeyPath)) {
        throw new Error('SIGNATURE_PRIVATE_KEY_PATH not configured or file not found');
      }

      const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf-8');
      const privateKey = forge.pki.privateKeyFromPem(privateKeyPem);

      const md2 = forge.md.sha256.create();
      md2.update(documentHash, 'hex' as any);
      const signature = privateKey.sign(md2);
      const signatureBase64 = Buffer.from(signature, 'binary').toString('base64');

      const certificatePath = this.configService.get<string>('signatures.certificatePath');
      let certificateSerial: string | null = null;

      if (certificatePath && fs.existsSync(certificatePath)) {
        try {
          const certPem = fs.readFileSync(certificatePath, 'utf-8');
          const cert = forge.pki.certificateFromPem(certPem);
          certificateSerial = cert.serialNumber;
        } catch (error) {
          this.logger.warn(`Could not read certificate serial: ${(error as any).message}`);
        }
      }

      const signature_record = await this.prisma.digitalSignature.create({
        data: {
          requirementInstanceId,
          documentVersionId,
          signedById: signedByUserId,
          signatureHash: signatureBase64,
          certificateSerial,
          timestamp: new Date(),
          metadata: {
            algorithm: 'RSA-SHA256',
            keyId: 'institutional-key',
            documentHash,
          },
        },
        include: {
          signedBy: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
      });

      if (requirementInstance.status === DocumentStatus.APROBADO) {
        await this.prisma.requirementInstance.update({
          where: { id: requirementInstanceId },
          data: { status: DocumentStatus.FINALIZADO },
        });
      }

      this.logger.log(`Document signed successfully: ${requirementInstanceId}`);
      return signature_record;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      this.logger.error(`Failed to sign document: ${(error as any).message}`);
      throw new BadRequestException(`Failed to sign document: ${(error as any).message}`);
    }
  }

  /**
   * Verify a digital signature
   */
  async verifySignature(signatureId: string): Promise<SignatureVerification & { reason?: string }> {
    const sig = await this.prisma.digitalSignature.findUnique({
      where: { id: signatureId },
      include: { signedBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!sig) throw new NotFoundException('Firma no encontrada');

    if (!sig.signedDocumentPath) throw new BadRequestException('No hay documento firmado asociado');

    const buffer: Buffer = await this.storageService.getFile(sig.signedDocumentPath);
    const currentHash = crypto.createHash('sha256').update(buffer).digest('hex');

    const isValid = currentHash === sig.signatureHash;
    return {
      isValid,
      details: {
        signedBy: `${sig.signedBy?.firstName || ''} ${sig.signedBy?.lastName || ''}`.trim(),
        timestamp: sig.timestamp.toISOString(),
        documentHash: sig.signatureHash,
      },
      reason: isValid ? undefined : 'Hash mismatch: documento modificado o archivo no encontrado',
    };
  }

  /**
   * Get all signatures for a degree process
   */
  async getSignaturesByProcess(processId: string) {
    return this.prisma.digitalSignature.findMany({
      where: {
        requirementInstance: { degreeProcessId: processId },
      },
      include: {
        signedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        documentVersion: {
          select: { id: true, fileName: true, originalFileName: true },
        },
        requirementInstance: {
          select: { id: true, status: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Get signatures for a specific requirement instance
   */
  async getSignaturesByDocument(requirementInstanceId: string) {
    return this.prisma.digitalSignature.findMany({
      where: { requirementInstanceId },
      include: {
        signedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        documentVersion: {
          select: { id: true, fileName: true, originalFileName: true, versionNumber: true },
        },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  /**
   * Generate RSA key pair (SUPERADMIN only)
   */
  async generateKeyPair(): Promise<KeyPairGenerationResult> {
    this.logger.log('Generating new RSA 2048-bit key pair');

    try {
      const keyPair = forge.pki.rsa.generateKeyPair({ bits: 2048 });
      const cert = forge.pki.createCertificate();
      cert.publicKey = keyPair.publicKey;
      cert.serialNumber = '01';
      cert.validity.notBefore = new Date();
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notAfter.getFullYear() + 5);

      const attrs = [
        { name: 'commonName', value: 'Instituto Tecnologico del Putumayo - CIECYT' },
        { name: 'organizationName', value: 'Instituto Tecnologico del Putumayo' },
        { name: 'organizationalUnitName', value: 'CIECYT - Centro de Investigaciones' },
        { name: 'localityName', value: 'Mocoa' },
        { name: 'stateOrProvinceName', value: 'Putumayo' },
        { name: 'countryName', value: 'CO' },
      ];

      cert.setSubject(attrs);
      cert.setIssuer(attrs);
      cert.sign(keyPair.privateKey, forge.md.sha256.create());

      const privateKeyPem = forge.pki.privateKeyToPem(keyPair.privateKey);
      const certificatePem = forge.pki.certificateToPem(cert);

      const privateKeyPath =
        this.configService.get<string>('signatures.privateKeyPath') || './certs/private-key.pem';
      const certificatePath =
        this.configService.get<string>('signatures.certificatePath') || './certs/certificate.pem';

      const privateKeyDir = path.dirname(privateKeyPath);
      if (!fs.existsSync(privateKeyDir)) {
        fs.mkdirSync(privateKeyDir, { recursive: true });
      }

      fs.writeFileSync(privateKeyPath, privateKeyPem, { mode: 0o600 });
      fs.writeFileSync(certificatePath, certificatePem, { mode: 0o644 });

      return {
        certificateInfo: {
          serial: cert.serialNumber,
          subject: `CN=${attrs[0].value}`,
          issuer: `CN=${attrs[0].value}`,
          validFrom: cert.validity.notBefore.toISOString(),
          validTo: cert.validity.notAfter.toISOString(),
        },
        message: 'Key pair generated and saved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to generate key pair: ${(error as any).message}`);
      throw new BadRequestException(`Failed to generate key pair: ${(error as any).message}`);
    }
  }

  /**
   * Get certificate information
   */
  async getCertificateInfo(): Promise<CertificateInfo> {
    try {
      const certificatePath = this.configService.get<string>('signatures.certificatePath');
      if (!certificatePath || !fs.existsSync(certificatePath)) {
        throw new NotFoundException('Certificate file not found');
      }

      const certPem = fs.readFileSync(certificatePath, 'utf-8');
      const cert = forge.pki.certificateFromPem(certPem);

      const formatName = (attrs: any[]) =>
        attrs.map((attr) => `${attr.name}=${attr.value}`).join(', ');

      return {
        serial: cert.serialNumber,
        subject: formatName(cert.subject.attributes),
        issuer: formatName(cert.issuer.attributes),
        validFrom: cert.validity.notBefore.toISOString(),
        validTo: cert.validity.notAfter.toISOString(),
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new BadRequestException(`Failed to get certificate info: ${(error as any).message}`);
    }
  }

  // =============================================
  // AUDIT LOGGING
  // =============================================

  /**
   * Log a signature audit event using the existing AuditEvent model
   */
  private async logAuditEvent(params: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    ipAddress?: string;
    details?: Record<string, any>;
  }): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: params.userId },
        select: { role: true },
      });

      await this.prisma.auditEvent.create({
        data: {
          userId: params.userId,
          userRole: user?.role || null,
          action: params.action,
          entity: params.entity,
          entityId: params.entityId,
          ipAddress: params.ipAddress || null,
          newValue: params.details || null,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to log audit event: ${(error as any).message}`);
    }
  }

  /**
   * Get signature audit logs with pagination and filters
   */
  async getSignatureAuditLogs(options: {
    page?: number;
    limit?: number;
    userId?: string;
    action?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = {
      action: { startsWith: 'SIGN' },
    };
    if (options.userId) where.userId = options.userId;
    if (options.action) where.action = options.action;

    const [data, total] = await Promise.all([
      this.prisma.auditEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true } },
        },
      }),
      this.prisma.auditEvent.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // =============================================
  // STUDENT NOTIFICATION (Email + In-App)
  // =============================================

  /**
   * Notify student when their process documents are signed
   */
  private async notifyStudentProcessSigned(process: any, signedCount: number): Promise<void> {
    try {
      const studentId = process.studentId || process.student?.id;
      const studentEmail = process.student?.email;
      const studentName = process.student?.firstName || 'Estudiante';
      const modalityName = process.modality?.name || '';

      if (!studentId) return;

      // In-app notification
      await this.notificationsService.createNotification(
        studentId,
        NotificationType.SIGNATURE_APPLIED,
        'Documentos Firmados',
        `Se han firmado ${signedCount} documento(s) de tu proceso de grado (${modalityName}). Ya puedes descargar los documentos firmados desde tu panel.`,
        { processId: process.id, signedCount },
      );

      // Email notification
      if (studentEmail) {
        const htmlBody = `
          <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="background: linear-gradient(135deg, #1e40af, #4338ca); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 22px;">Documentos Firmados</h1>
            </div>
            <div style="background: #ffffff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
              <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                Hola <strong>${studentName}</strong>,
              </p>
              <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                Te informamos que se han firmado digitalmente <strong>${signedCount} documento(s)</strong>
                de tu proceso de grado <strong>${modalityName}</strong>.
              </p>
              <p style="color: #334155; font-size: 15px; line-height: 1.6;">
                Ya puedes acceder a tu panel y descargar los documentos firmados con las firmas institucionales correspondientes.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${this.configService.get<string>('app.corsOrigin') || 'http://localhost:4200'}/process/${process.id}"
                   style="display: inline-block; padding: 12px 32px; background: #1e40af; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
                  Ver Mi Proceso
                </a>
              </div>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
              <p style="color: #94a3b8; font-size: 12px; text-align: center;">
                Este es un mensaje automático del Sistema de Gestión de Grados — ITP
              </p>
            </div>
          </div>
        `;

        await this.notificationsService
          .sendEmailNotification(
            studentEmail,
            `Documentos Firmados — Proceso de Grado ${modalityName}`,
            htmlBody,
          )
          .catch((err) => {
            this.logger.warn(`Email notification failed for ${studentEmail}: ${err.message}`);
          });
      }
    } catch (error) {
      this.logger.warn(`Failed to notify student: ${(error as any).message}`);
    }
  }

  // =============================================
  // PAGINATED PROCESSES READY FOR SIGNING
  // =============================================

  /**
   * Get processes ready for signing with pagination (for 2000+ students)
   */
  async getProcessesReadyForSigningPaginated(options: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: any = { status: ProcessStatus.APPROVED };

    if (options.search) {
      const search = options.search.trim();
      where.OR = [
        { student: { firstName: { contains: search, mode: 'insensitive' } } },
        { student: { lastName: { contains: search, mode: 'insensitive' } } },
        { modality: { name: { contains: search, mode: 'insensitive' } } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.degreeProcess.findMany({
        where,
        skip,
        take: limit,
        include: {
          student: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          advisor: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          modality: { select: { id: true, name: true, code: true } },
          requirementInstances: {
            include: {
              modalityRequirement: {
                include: { documentType: { include: { signatureConfigs: true } } },
              },
              documentVersions: {
                orderBy: { uploadedAt: 'desc' },
                take: 1,
              },
              digitalSignatures: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.degreeProcess.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  // =============================================
  // ARCHIVE PROCESSES
  // =============================================

  /**
   * Archive a completed process (COMPLETED → ARCHIVED)
   */
  async archiveProcess(processId: string, userId: string, ipAddress?: string) {
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
    });

    if (!process) throw new NotFoundException('Proceso no encontrado');
    if (process.status !== ProcessStatus.COMPLETED) {
      throw new BadRequestException(
        `Solo se pueden archivar procesos en estado COMPLETED. Estado actual: ${process.status}`,
      );
    }

    const updated = await this.prisma.degreeProcess.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await this.logAuditEvent({
      userId,
      action: 'ARCHIVE_PROCESS',
      entity: 'DegreeProcess',
      entityId: processId,
      ipAddress,
      details: { previousStatus: ProcessStatus.COMPLETED },
    });

    return { message: 'Proceso archivado correctamente', process: updated };
  }

  /**
   * Bulk archive: archive all completed processes older than N days
   */
  async archiveCompletedProcesses(daysOld: number, userId: string, ipAddress?: string) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const processes = await this.prisma.degreeProcess.findMany({
      where: {
        status: ProcessStatus.COMPLETED,
        completedAt: { lte: cutoffDate },
      },
      select: { id: true },
    });

    if (processes.length === 0) {
      return { archivedCount: 0, message: 'No hay procesos para archivar' };
    }

    await this.prisma.degreeProcess.updateMany({
      where: {
        id: { in: processes.map((p) => p.id) },
      },
      data: {
        status: ProcessStatus.ARCHIVED,
        archivedAt: new Date(),
      },
    });

    await this.logAuditEvent({
      userId,
      action: 'BULK_ARCHIVE',
      entity: 'DegreeProcess',
      entityId: 'bulk',
      ipAddress,
      details: { archivedCount: processes.length, daysOld },
    });

    return {
      archivedCount: processes.length,
      message: `${processes.length} proceso(s) archivado(s) correctamente`,
    };
  }

  // =============================================
  // UNSIGN / REVERT SIGNATURE
  // =============================================

  /**
   * Revert a signed document back to APROBADO status
   * Removes digital signatures and deletes the signed PDF
   */
  async unsignRequirement(
    processId: string,
    requirementInstanceId: string,
    userId: string,
    ipAddress?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Solo ADMIN o SUPERADMIN pueden revertir firmas');
    }

    const reqInstance = await this.prisma.requirementInstance.findUnique({
      where: { id: requirementInstanceId },
      include: {
        digitalSignatures: true,
        modalityRequirement: { include: { documentType: true } },
      },
    });

    if (!reqInstance) throw new NotFoundException('Requisito no encontrado');
    if (reqInstance.degreeProcessId !== processId) {
      throw new BadRequestException('El requisito no pertenece a este proceso');
    }
    if (reqInstance.status !== DocumentStatus.FINALIZADO) {
      throw new BadRequestException(
        `Solo se pueden revertir documentos en estado FINALIZADO. Estado actual: ${reqInstance.status}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Delete signed document files
      for (const sig of reqInstance.digitalSignatures) {
        if (sig.signedDocumentPath) {
          try {
            await this.storageService.deleteFile(sig.signedDocumentPath);
          } catch (e) {
            this.logger.warn(`Could not delete signed file: ${sig.signedDocumentPath}`);
          }
        }
      }

      // Remove all digital signatures for this requirement
      await tx.digitalSignature.deleteMany({
        where: { requirementInstanceId },
      });

      // Revert status to APROBADO
      await tx.requirementInstance.update({
        where: { id: requirementInstanceId },
        data: { status: DocumentStatus.APROBADO },
      });

      // If process was COMPLETED, revert to APPROVED
      const process = await tx.degreeProcess.findUnique({
        where: { id: processId },
      });
      if (process?.status === ProcessStatus.COMPLETED) {
        await tx.degreeProcess.update({
          where: { id: processId },
          data: {
            status: ProcessStatus.APPROVED,
            completedAt: null,
          },
        });
      }
    });

    // Audit log
    await this.logAuditEvent({
      userId,
      action: 'UNSIGN_REQUIREMENT',
      entity: 'RequirementInstance',
      entityId: requirementInstanceId,
      ipAddress,
      details: {
        processId,
        documentType: reqInstance.modalityRequirement.documentType.name,
        removedSignatures: reqInstance.digitalSignatures.length,
      },
    });

    return {
      message: 'Firma revertida correctamente. El documento vuelve a estado APROBADO.',
      requirementInstanceId,
      processId,
    };
  }
}
