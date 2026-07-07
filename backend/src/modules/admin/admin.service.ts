/* admin.service.ts */
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPromise } from '@prisma/client';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { StorageService } from '../../shared/storage/storage.service';
import { UserRole } from '../../shared/decorators/roles.decorator';
import { CreateModalityDto, UpdateModalityDto, AddRequirementDto, UpdateRequirementDto } from './dto/modality.dto';
import { CreateDocumentTypeDto, UpdateDocumentTypeDto } from './dto/document-type.dto';
import { CreateModalityResourceDto } from './dto/modality-resource.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { normalizeAndValidateModalityCode } from './utils/modality-code.util';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private storageService: StorageService,
    private configService: ConfigService,
  ) {}

  private normalizeDocumentTypeCode(name: string): string {
    const code = name
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_]/g, '_')
      .replace(/__+/g, '_')
      .replace(/^_|_$/g, '');

    return code || `DOCUMENT_TYPE_${Date.now()}`;
  }

  private async getOrCreateDocumentTypeByName(name: string) {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new BadRequestException('Document type name is required');
    }

    const code = this.normalizeDocumentTypeCode(normalizedName);

    const existing = await this.prisma.documentType.findFirst({
      where: {
        OR: [{ name: normalizedName }, { code }],
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.documentType.create({
      data: {
        name: normalizedName,
        code,
        description: normalizedName,
        acceptedMimeTypes: ['application/pdf'],
        maxFileSizeMb: 10,
      },
    });
  }

  /**
   * Get dashboard statistics with complete process metrics
   */
  async getDashboardStats() {
    const [
      totalProcesses,
      totalStudents,
      totalAdvisors,
      processesByStatusRaw,
      processesByModalityRaw,
      pendingReviews,
      recentActivityRaw,
      modalities,
    ] = await Promise.all([
      // Total de procesos activos (excluyendo DRAFT y ARCHIVED)
      this.prisma.degreeProcess.count({
        where: {
          status: { notIn: ['DRAFT', 'ARCHIVED'] },
        },
      }),
      // Total de estudiantes
      this.prisma.user.count({
        where: { role: UserRole.STUDENT },
      }),
      // Total de asesores
      this.prisma.user.count({
        where: { role: UserRole.ADVISOR },
      }),
      // Agrupación por estado
      this.prisma.degreeProcess.groupBy({
        by: ['status'],
        _count: true,
      }),
      // Agrupación por modalidad
      this.prisma.degreeProcess.groupBy({
        by: ['modalityId'],
        _count: true,
      }),
      // Documentos en revisión
      this.prisma.requirementInstance.count({
        where: { status: 'EN_REVISION' },
      }),
      // Actividad reciente (últimos 10 eventos de auditoría)
      this.prisma.auditEvent.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
      // Obtener todas las modalidades para mapeo
      this.prisma.degreeModality.findMany({
        select: { id: true, code: true, name: true },
      }),
    ]);

    // Transformar processesByStatus: _count → count
    const processesByStatus = processesByStatusRaw.map((item) => ({
      status: item.status,
      count: item._count,
    }));

    // Calcular activeProcesses (ACTIVE + IN_REVIEW)
    const activeProcesses = processesByStatus
      .filter((item) => item.status === 'ACTIVE' || item.status === 'IN_REVIEW')
      .reduce((sum, item) => sum + item.count, 0);

    // Calcular completedProcesses
    const completedProcesses = processesByStatus
      .filter((item) => item.status === 'COMPLETED')
      .reduce((sum, item) => sum + item.count, 0);

    // Transformar processesByModality: incluir modalityId → modality code
    const modalityMap = new Map(modalities.map((m) => [m.id, m.code]));
    const processesByModality = processesByModalityRaw.map((item) => ({
      modality: modalityMap.get(item.modalityId) || 'UNKNOWN',
      count: item._count,
    }));

    // Transformar recentActivity al formato esperado por frontend
    const recentActivity = recentActivityRaw.map((item) => ({
      action: `${item.action} - ${item.entity}`,
      date: item.timestamp.toISOString(),
      user: `${item.user?.firstName || ''} ${item.user?.lastName || ''}`.trim(),
    }));

    return {
      totalProcesses,
      activeProcesses,
      completedProcesses,
      pendingReviews,
      totalStudents,
      totalAdvisors,
      processesByStatus,
      processesByModality,
      recentActivity,
    };
  }

  /**
   * Get all modalities
   */
  async getModalities() {
    const modalities = await this.prisma.degreeModality.findMany({
      include: {
        modalityRequirements: {
          include: {
            documentType: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        resources: {
          select: {
            id: true,
            label: true,
            description: true,
            originalFileName: true,
            mimeType: true,
            fileSizeByte: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Map modalityRequirements → requirements for frontend compatibility
    return modalities.map(({ modalityRequirements, resources, ...rest }) => {
      const latestResourceByLabel = new Map<string, { originalFileName: string }>();
      for (const resource of resources) {
        if (!latestResourceByLabel.has(resource.label)) {
          latestResourceByLabel.set(resource.label, {
            originalFileName: resource.originalFileName,
          });
        }
      }

      return {
        ...rest,
        requirements: modalityRequirements.map((requirement) => ({
          ...requirement,
          existingFileName:
            latestResourceByLabel.get(requirement.documentType.name)
              ?.originalFileName ?? null,
        })),
        resources,
      };
    });
  }

  /**
   * Create a new modality
   */
  async createModality(dto: CreateModalityDto) {
    // Normalize code: uppercase, replace spaces with underscores
    const normalizedCode = normalizeAndValidateModalityCode(dto.code);

    // verificar que no exista otra modalidad con el mismo código
    const existingModality = await this.prisma.degreeModality.findFirst({
      where: {
        OR: [{ name: { equals: dto.name, mode: 'insensitive' } }, 
          { code: normalizedCode }],
      },
    });

    // Si ya existe una modalidad con el mismo nombre o código, lanzar error
    if (existingModality) {
      throw new BadRequestException('Ya existe una modalidad con el mismo nombre o código');
    }

    // Si todo es válido, crear la modalidad
    return this.prisma.degreeModality.create({
      data: {
        name: dto.name,
        code: normalizedCode,
        description: dto.description,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Update a modality
   */
  async updateModality(id: string, dto: UpdateModalityDto) {
    const modality = await this.prisma.degreeModality.findUnique({
      where: { id },
    });

    if (!modality) {
      throw new NotFoundException('Modality not found');
    }

    return this.prisma.degreeModality.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Add requirement to modality
   */
  async normalizeRequirementOrders(modalityId: string) {
    const requirements = await this.prisma.modalityRequirement.findMany({
      where: { modalityId },
      orderBy: { displayOrder: 'asc' },
    });

    let order = 1;
    await this.prisma.$transaction(
      requirements.map((requirement) =>
        this.prisma.modalityRequirement.update({
          where: { id: requirement.id },
          data: { displayOrder: order++ },
        }),
      ),
    );
  }

  async addRequirementToModality(
    modalityId: string,
    dto: AddRequirementDto,
    uploadedById: string,
    file?: Express.Multer.File,
  ) {
    const modality = await this.prisma.degreeModality.findUnique({
      where: { id: modalityId },
    });

    if (!modality) {
      throw new NotFoundException('Modality not found');
    }

    let documentType;
    if (dto.documentTypeId) {
      documentType = await this.prisma.documentType.findUnique({
        where: { id: dto.documentTypeId },
      });
      if (!documentType) {
        throw new NotFoundException('Document type not found');
      }
    } else if (dto.documentTypeName) {
      documentType = await this.getOrCreateDocumentTypeByName(dto.documentTypeName);
    } else {
      throw new BadRequestException('Selecciona o ingresa un tipo de documento.');
    }

    const existingRequirement = await this.prisma.modalityRequirement.findUnique({
      where: {
        modalityId_documentTypeId: {
          modalityId,
          documentTypeId: documentType.id,
        },
      },
    });

    if (existingRequirement) {
      throw new BadRequestException(
        'This document type is already a requirement for this modality',
      );
    }

    const existing = await this.prisma.modalityRequirement.findMany({
      where: { modalityId },
      orderBy: { displayOrder: 'asc' },
    });

    const maxOrder = existing.length + 1;
    const desiredOrder = Math.min(Math.max(dto.displayOrder, 1), maxOrder);

    if (desiredOrder <= existing.length) {
      await this.prisma.$transaction(
        existing
          .filter((req) => req.displayOrder >= desiredOrder)
          .map((requirement) =>
            this.prisma.modalityRequirement.update({
              where: { id: requirement.id },
              data: { displayOrder: requirement.displayOrder + 1 },
            }),
          ),
      );
    }

    if (file) {
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      const maxFileSize =
        this.configService.get<number>('app.maxFileSize') || 52428800;

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Only PDF or Word files are accepted.');
      }

      if (file.size > maxFileSize) {
        const maxSizeMb = (maxFileSize / (1024 * 1024)).toFixed(2);
        throw new BadRequestException(
          `File size exceeds maximum allowed size of ${maxSizeMb}MB`,
        );
      }
    }

    const requirement = await this.prisma.modalityRequirement.create({
      data: {
        modalityId,
        documentTypeId: documentType.id,
        isRequired: dto.isRequired ?? true,
        displayOrder: desiredOrder,
        instructions: dto.instructions,
      },
      include: {
        documentType: true,
        modality: true,
      },
    });

    if (file) {
      const subPath = `modality-resource/${modalityId}`;
      try {
        const uploadResult = await this.storageService.uploadFile(file, subPath);

        await this.prisma.modalityResource.create({
          data: {
            modalityId,
            label: documentType.name,
            description: dto.instructions || documentType.description,
            fileName:
              uploadResult.storagePath.split('/').pop() || file.originalname,
            originalFileName: file.originalname,
            mimeType: file.mimetype,
            fileSizeByte: file.size,
            storagePath: uploadResult.storagePath,
            uploadedById,
          },
        });
      } catch (error) {
        await this.prisma.modalityRequirement.delete({ where: { id: requirement.id } });
        throw error;
      }
    }

    await this.normalizeRequirementOrders(modalityId);
    return requirement;
  }

  /**
   * Remove requirement from modality
   */
  async removeRequirementFromModality(modalityId: string, requirementId: string) {
    const requirement = await this.prisma.modalityRequirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement not found');
    }

    if (requirement.modalityId !== modalityId) {
      throw new BadRequestException('Requirement does not belong to this modality');
    }

    await this.prisma.modalityRequirement.delete({ where: { id: requirementId } });
    await this.normalizeRequirementOrders(modalityId);

    return { success: true };
  }

  async updateRequirement(
    modalityId: string,
    requirementId: string,
    dto: UpdateRequirementDto,
    uploadedById: string,
    file?: Express.Multer.File,
  ) {
    const modality = await this.prisma.degreeModality.findUnique({
      where: { id: modalityId },
    });

    if (!modality) {
      throw new NotFoundException('Modality not found');
    }

    const requirement = await this.prisma.modalityRequirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement not found');
    }

    if (requirement.modalityId !== modalityId) {
      throw new BadRequestException('Requirement does not belong to this modality');
    }

    let newDocumentTypeId = requirement.documentTypeId;
    if (dto.documentTypeName?.trim()) {
      const newType = await this.getOrCreateDocumentTypeByName(dto.documentTypeName);
      newDocumentTypeId = newType.id;
    } else if (dto.documentTypeId) {
      if (dto.documentTypeId !== requirement.documentTypeId) {
        const newType = await this.prisma.documentType.findUnique({
          where: { id: dto.documentTypeId },
        });
        if (!newType) {
          throw new NotFoundException('Document type not found');
        }
        newDocumentTypeId = newType.id;
      }
    }

    if (newDocumentTypeId !== requirement.documentTypeId) {
      const existingRequirement = await this.prisma.modalityRequirement.findUnique({
        where: {
          modalityId_documentTypeId: {
            modalityId,
            documentTypeId: newDocumentTypeId,
          },
        },
      });
      if (existingRequirement) {
        throw new BadRequestException(
          'This document type is already a requirement for this modality',
        );
      }
    }

    const requirements = await this.prisma.modalityRequirement.findMany({
      where: { modalityId },
      orderBy: { displayOrder: 'asc' },
    });

    let newDisplayOrder = requirement.displayOrder;
    if (dto.displayOrder !== undefined) {
      const maxOrder = requirements.length;
      newDisplayOrder = Math.min(Math.max(dto.displayOrder, 1), maxOrder);
    }

    const updates = [] as PrismaPromise<any>[];
    if (newDisplayOrder !== requirement.displayOrder) {
      const movingUp = newDisplayOrder < requirement.displayOrder;
      const movingDown = newDisplayOrder > requirement.displayOrder;

      if (movingUp) {
        updates.push(
          ...requirements
            .filter(
              (req) =>
                req.id !== requirement.id &&
                req.displayOrder >= newDisplayOrder &&
                req.displayOrder < requirement.displayOrder,
            )
            .map((req) =>
              this.prisma.modalityRequirement.update({
                where: { id: req.id },
                data: { displayOrder: req.displayOrder + 1 },
              }),
            ),
        );
      }
      if (movingDown) {
        updates.push(
          ...requirements
            .filter(
              (req) =>
                req.id !== requirement.id &&
                req.displayOrder <= newDisplayOrder &&
                req.displayOrder > requirement.displayOrder,
            )
            .map((req) =>
              this.prisma.modalityRequirement.update({
                where: { id: req.id },
                data: { displayOrder: req.displayOrder - 1 },
              }),
            ),
        );
      }
    }

    await this.prisma.$transaction(updates);

    const updatedRequirement = await this.prisma.modalityRequirement.update({
      where: { id: requirementId },
      data: {
        documentTypeId: newDocumentTypeId,
        isRequired: dto.isRequired ?? requirement.isRequired,
        displayOrder: newDisplayOrder,
        instructions: dto.instructions ?? requirement.instructions,
      },
      include: {
        documentType: true,
      },
    });

    if (file) {
      const documentTypeForLabel = await this.prisma.documentType.findUnique({
        where: { id: updatedRequirement.documentTypeId },
      });
      const allowedMimeTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      const maxFileSize =
        this.configService.get<number>('app.maxFileSize') || 52428800;

      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException('Only PDF or Word files are accepted.');
      }

      if (file.size > maxFileSize) {
        const maxSizeMb = (maxFileSize / (1024 * 1024)).toFixed(2);
        throw new BadRequestException(
          `File size exceeds maximum allowed size of ${maxSizeMb}MB`,
        );
      }

      const subPath = `modality-resource/${modalityId}`;
      const uploadResult = await this.storageService.uploadFile(file, subPath);
      await this.prisma.modalityResource.create({
        data: {
          modalityId,
          label: documentTypeForLabel?.name ?? updatedRequirement.documentType.name,
          description: dto.instructions ?? updatedRequirement.instructions ?? documentTypeForLabel?.description,
          fileName: uploadResult.storagePath.split('/').pop() || file.originalname,
          originalFileName: file.originalname,
          mimeType: file.mimetype,
          fileSizeByte: file.size,
          storagePath: uploadResult.storagePath,
          uploadedById,
        },
      });
    }

    await this.normalizeRequirementOrders(modalityId);

    return updatedRequirement;
  }

  async uploadModalityResource(
    modalityId: string,
    dto: CreateModalityResourceDto,
    file: Express.Multer.File,
    uploadedById: string,
  ) {
    const modality = await this.prisma.degreeModality.findUnique({
      where: { id: modalityId },
    });

    if (!modality) {
      throw new NotFoundException('Modality not found');
    }

    const subPath = `modality-resource/${modalityId}`;
    const uploadResult = await this.storageService.uploadFile(file, subPath);

    return this.prisma.modalityResource.create({
      data: {
        modalityId,
        label: dto.label,
        description: dto.description,
        fileName: uploadResult.storagePath.split('/').pop() || file.originalname,
        originalFileName: file.originalname,
        mimeType: file.mimetype,
        fileSizeByte: file.size,
        storagePath: uploadResult.storagePath,
        uploadedById,
      },
    });
  }

  async getModalityResources(modalityId: string) {
    const modality = await this.prisma.degreeModality.findUnique({
      where: { id: modalityId },
    });

    if (!modality) {
      throw new NotFoundException('Modality not found');
    }

    return this.prisma.modalityResource.findMany({
      where: { modalityId },
      select: {
        id: true,
        label: true,
        description: true,
        originalFileName: true,
        mimeType: true,
        fileSizeByte: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async downloadModalityResource(resourceId: string, modalityId: string) {
    const resource = await this.prisma.modalityResource.findUnique({
      where: { id: resourceId },
    });

    if (!resource || resource.modalityId !== modalityId) {
      throw new NotFoundException('Modality resource not found');
    }

    const buffer = await this.storageService.getFile(resource.storagePath);

    return {
      buffer,
      fileName: resource.originalFileName,
      mimeType: resource.mimeType,
    };
  }

  /**
   * Get all document types
   */
  async getDocumentTypes() {
    return this.prisma.documentType.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Create a new document type
   */
  async createDocumentType(dto: CreateDocumentTypeDto) {
    const existingDocType = await this.prisma.documentType.findUnique({
      where: { code: dto.code },
    });

    if (existingDocType) {
      throw new BadRequestException('Document type with this code already exists');
    }

    return this.prisma.documentType.create({
      data: {
        name: dto.name,
        code: dto.code,
        description: dto.description,
        acceptedMimeTypes: dto.acceptedMimeTypes,
        maxFileSizeMb: dto.maxFileSizeMb ?? 10,
        templateUrl: dto.templateUrl,
      },
    });
  }

  /**
   * Update a document type
   */
  async updateDocumentType(id: string, dto: UpdateDocumentTypeDto) {
    const documentType = await this.prisma.documentType.findUnique({
      where: { id },
    });

    if (!documentType) {
      throw new NotFoundException('Document type not found');
    }

    return this.prisma.documentType.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Get users with optional filtering
   */
  async getUsers(filters: UserFilterDto) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.role) {
      where.role = filters.role;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { firstName: { contains: filters.search, mode: 'insensitive' } },
        { lastName: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          isActive: true,
          emailVerified: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Update user role (SUPERADMIN only)
   * Automatically creates/manages profile based on new role
   */
  async updateUserRole(userId: string, newRole: UserRole) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        studentProfile: true,
        advisorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent downgrading superadmin
    if (user.role === UserRole.SUPERADMIN && newRole !== UserRole.SUPERADMIN) {
      throw new ForbiddenException('Cannot downgrade a superadmin user');
    }

    // Create AdvisorProfile if changing to ADVISOR and doesn't have one
    if (newRole === UserRole.ADVISOR && !user.advisorProfile) {
      await this.prisma.advisorProfile.create({
        data: {
          userId,
          department: 'Por asignar',
          specialization: 'Por asignar',
          maxActiveProcesses: 5,
          isAvailable: true,
        },
      });
    }

    // Create StudentProfile if changing to STUDENT and doesn't have one
    if (newRole === UserRole.STUDENT && !user.studentProfile) {
      await this.prisma.studentProfile.create({
        data: {
          user: { connect: { id: userId } },
          studentCode: `STU-${Date.now()}`,
          program: 'Por asignar',
          faculty: 'Por asignar',
          semester: 1,
          hasCompletedSubjects: false,
          academicStatus: 'ACTIVE',
        },
      });
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role: newRole },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }

  /**
   * Toggle user active status
   */
  async toggleUserActive(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Prevent deactivating superadmin
    if (user.role === UserRole.SUPERADMIN && user.isActive) {
      throw new ForbiddenException('Cannot deactivate a superadmin user');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });
  }

  /**
   * Get system health check
   */
  async getSystemHealth() {
    try {
      // Test database connection
      const dbHealthy = !!(await this.prisma.user.findFirst({
        take: 1,
        select: { id: true },
      }));

      return {
        status: 'healthy',
        database: dbHealthy ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        database: 'disconnected',
        error: (error as Error).message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
