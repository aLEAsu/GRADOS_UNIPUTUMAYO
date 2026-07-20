import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { IntegrationService } from '../integration/integration.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '@prisma/client';
import { StudentEligibilityResult } from '../integration/dto/external-student.dto';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { CreateProcessDto } from './dto/create-process.dto';
import { AssignAdvisorDto } from './dto/assign-advisor.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ProcessFilterDto } from './dto/process-filter.dto';
import {
  ProcessStateMachine,
  ProcessStatus,
} from './domain/process-state-machine';
import {
  DocumentStateMachine,
  DocumentStatus,
} from './domain/document-state-machine';
import {
  DomainError,
  InvalidStateTransitionError,
  BusinessRuleViolationError,
  InsufficientPermissionsError,
} from './domain/errors';

/**
 * Service for managing degree processes
 * Coordinates between domain logic and data persistence
 */
@Injectable()
export class DegreeProcessService {
  private readonly logger = new Logger(DegreeProcessService.name);
  private readonly maxActiveProcessesPerAdvisor: number;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private integrationService: IntegrationService,
    private notificationsService: NotificationsService,
  ) {
    this.maxActiveProcessesPerAdvisor =
      this.configService.get('degree.maxActiveProcessesPerAdvisor') || 10;
  }

  /**
   * Get all available degree modalities
   * Used by students during process creation
   */
  async getModalities() {
    const modalities = await this.prisma.degreeModality.findMany({
      where: { isActive: true },
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
      const requirementLabels = new Set(
        modalityRequirements
          .map((req) => req.documentType?.name?.trim())
          .filter((label): label is string => !!label),
      );

      const filteredResources = Array.from(
        new Map(
          resources
            .filter((resource) => requirementLabels.has(resource.label))
            .map((resource) => [resource.label, resource]),
        ).values(),
      );

      return {
        ...rest,
        requirements: modalityRequirements,
        resources: filteredResources,
      };
    });
  }

  /**
   * Create a new degree process
   * Student inscription starts in DRAFT status with auto-generated requirements
   *
   * @param studentUserId ID of the student creating the process
   * @param createProcessDto Process creation data
   * @returns Created process with requirements
   * @throws NotFoundException if student or modality not found
   * @throws BusinessRuleViolationError if student already has active process
   */
  async createProcess(
    studentUserId: string,
    createProcessDto: CreateProcessDto,
  ) {
    this.logger.debug(
      `Creating degree process for student: ${studentUserId}`,
    );

    // Validate student exists
    const student = await this.prisma.user.findUnique({
      where: { id: studentUserId },
      include: { studentProfile: true },
    });

    if (!student) {
      throw new NotFoundException(`Student with ID ${studentUserId} not found`);
    }

    if (!student.studentProfile) {
      throw new BadRequestException(
        'User does not have a student profile',
      );
    }

    // Check if student has completed required subjects.
    // Behavior depends on integration flag:
    // - If `ITP_INTEGRATION_ENABLED` = true: try to validate against external API and update profile.
    // - If disabled (local/testing): allow creation for registered users (skip external validation).
    if (!student.studentProfile.hasCompletedSubjects) {
      const integrationEnabled = this.configService.get<boolean>('ITP_INTEGRATION_ENABLED') === true;

      if (!integrationEnabled) {
        this.logger.warn(
          `ITP integration disabled: allowing process creation for local user ${studentUserId}`,
        );
        // Local/testing mode: skip external eligibility check and allow creation
      } else {
        try {
          const result: StudentEligibilityResult = await this.integrationService.validateStudentEligibility(
            student.studentProfile.studentCode,
          );

          if (result.eligible) {
            // Persist the positive eligibility to avoid repeated external calls
            await this.prisma.studentProfile.update({
              where: { userId: studentUserId },
              data: { hasCompletedSubjects: true },
            });
          } else {
            throw new BusinessRuleViolationError(
              result.reason || 'Student must have completed required subjects to create a degree process',
            );
          }
        } catch (err) {
          const message = err?.message || 'Student must have completed required subjects to create a degree process';
          throw new BusinessRuleViolationError(message);
        }
      }
    }

    // Check if student already has an active process
    const activeProcess = await this.prisma.degreeProcess.findFirst({
      where: {
        studentId: studentUserId,
        status: {
          in: [
            ProcessStatus.DRAFT,
            ProcessStatus.ACTIVE,
            ProcessStatus.IN_REVIEW,
            ProcessStatus.APPROVED,
            ProcessStatus.COMPLETED,
          ],
        },
      },
    });

    if (activeProcess) {
      throw new BusinessRuleViolationError(
        'Student already has an active degree process',
      );
    }

    // Validate modality exists
    const modality = await this.prisma.degreeModality.findUnique({
      where: { id: createProcessDto.modalityId },
      include: { modalityRequirements: true },
    });

    if (!modality) {
      throw new NotFoundException(
        `Modality with ID ${createProcessDto.modalityId} not found`,
      );
    }

    // Create the process in DRAFT status
    const process = await this.prisma.degreeProcess.create({
      data: {
        studentId: studentUserId,
        modalityId: createProcessDto.modalityId,
        status: ProcessStatus.DRAFT,
        title: createProcessDto.title,
        description: createProcessDto.description,
        startedAt: new Date(),
        // Auto-generate requirement instances from modality requirements
        requirementInstances: {
          create: modality.modalityRequirements.map((mr) => ({
            modalityRequirementId: mr.id,
            status: DocumentStatus.POR_CARGAR,
          })),
        },
      },
      include: {
        student: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        modality: { select: { id: true, code: true, name: true } },
        advisor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        requirementInstances: {
          include: { modalityRequirement: true, documentVersions: true },
        },
      },
    });

    this.logger.log(`Degree process created: ${process.id}`);

    // Create notifications: inform student and staff
    try {
      await this.notificationsService.createNotification(
        process.student.id,
        NotificationType.GENERAL,
        'Tu proceso fue creado',
        `Tu proceso "${process.title}" se ha creado correctamente.`,
        { processId: process.id, target: `/process/${process.id}` },
      );

      const staff = await this.prisma.user.findMany({
        where: { role: { in: ['SECRETARY', 'ADMIN', 'SUPERADMIN'] } },
        select: { id: true },
      });

      for (const s of staff) {
        // Use the standard process detail route so staff can open the exact process
        await this.notificationsService.createNotification(
          s.id,
          NotificationType.GENERAL,
          'Nuevo proceso creado',
          `El estudiante ${process.student.firstName} ${process.student.lastName} creó el proceso "${process.title}".`,
          { processId: process.id, target: `/process/${process.id}` },
        );
      }
    } catch (err) {
      this.logger.warn('Failed to create process notifications: ' + err.message);
    }

    return process;
  }

  /**
   * Get a degree process by ID with permission filtering
   *
   * @param processId ID of the process
   * @param userId ID of the requesting user
   * @param userRole Role of the requesting user
   * @returns Process data if accessible
   * @throws NotFoundException if process not found
   * @throws ForbiddenException if user lacks access
   */
  async getProcessById(
    processId: string,
    userId: string,
    userRole: string,
  ) {
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
      include: {
        student: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        modality: { select: { id: true, code: true, name: true } },
        advisor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        requirementInstances: {
          include: {
            modalityRequirement: {
              include: {
                documentType: true,
              },
            },
            documentVersions: {
              orderBy: { uploadedAt: 'desc' },
              include: {
                uploadedBy: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
            approvals: {
              include: {
                approverUser: {
                  select: { id: true, firstName: true, lastName: true },
                },
              },
            },
          },
        },
      },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID ${processId} not found`);
    }

    // Permission check
    this.checkAccessPermission(process, userId, userRole);

    return process;
  }

  /**
   * Get all processes for a student
   *
   * @param studentUserId ID of the student
   * @returns List of student's processes
   */
  async getProcessesByStudent(studentUserId: string) {
    return this.prisma.degreeProcess.findMany({
      where: { studentId: studentUserId },
      include: {
        modality: { select: { id: true, code: true, name: true } },
        advisor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        requirementInstances: {
          select: {
            id: true,
            status: true,
            modalityRequirement: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all processes assigned to an advisor
   *
   * @param advisorUserId ID of the advisor
   * @returns List of assigned processes
   */
  async getProcessesByAdvisor(advisorUserId: string) {
    return this.prisma.degreeProcess.findMany({
      where: { advisorId: advisorUserId },
      include: {
        student: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        advisor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        modality: { select: { id: true, code: true, name: true } },
        requirementInstances: {
          select: {
            id: true,
            status: true,
            modalityRequirement: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all processes with filtering and pagination (admin/secretary only)
   *
   * @param filters Process filter criteria
   * @returns Paginated list of processes
   */
  async getAllProcesses(filters: ProcessFilterDto) {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.studentId) {
      where.studentId = filters.studentId;
    }

    if (filters.advisorId) {
      where.advisorId = filters.advisorId;
    }

    if (filters.modalityCode) {
      where.modality = {
        code: filters.modalityCode,
      };
    }

    if (filters.search) {
      where.OR = [
        {
          title: {
            contains: filters.search,
            mode: 'insensitive',
          },
        },
        {
          student: {
            OR: [
              {
                firstName: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
              {
                lastName: {
                  contains: filters.search,
                  mode: 'insensitive',
                },
              },
            ],
          },
        },
      ];
    }

    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const [processes, total] = await Promise.all([
      this.prisma.degreeProcess.findMany({
        where,
        include: {
          student: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          modality: { select: { id: true, code: true, name: true } },
          advisor: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          requirementInstances: {
            select: {
              id: true,
              status: true,
              modalityRequirement: true,
            },
          },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.degreeProcess.count({ where }),
    ]);

    return {
      data: processes,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Assign an advisor to a process
   * Validates advisor availability and max active processes
   *
   * @param processId ID of the process
   * @param assignAdvisorDto Advisor assignment data
   * @param assignedByUserId ID of user performing assignment (secretary/admin)
   * @returns Updated process with advisor
   * @throws NotFoundException if process or advisor not found
   * @throws BusinessRuleViolationError if advisor unavailable or max processes exceeded
   */
  async assignAdvisor(
    processId: string,
    assignAdvisorDto: AssignAdvisorDto,
    assignedByUserId: string,
  ) {
    this.logger.debug(`Assigning advisor to process: ${processId}`);

    // Verify process exists
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID ${processId} not found`);
    }

    if (process.advisorId) {
      throw new BusinessRuleViolationError(
        'Degree process already has an assigned advisor',
      );
    }

    // Verify advisor exists and has correct role
    const advisor = await this.prisma.user.findUnique({
      where: { id: assignAdvisorDto.advisorUserId },
    });

    if (!advisor) {
      throw new NotFoundException(
        `Advisor with ID ${assignAdvisorDto.advisorUserId} not found`,
      );
    }

    if (!['ADVISOR'].includes(advisor.role)) {
      throw new BusinessRuleViolationError(
        'Assigned user must have ADVISOR role',
      );
    }

    const advisorProfile = await this.prisma.advisorProfile.findUnique({
      where: { userId: assignAdvisorDto.advisorUserId },
    });

    if (!advisorProfile || !advisorProfile.isAvailable) {
      throw new BusinessRuleViolationError(
        'Assigned advisor must have an available advisor profile',
      );
    }

    // Check advisor's max active processes
    const activeProcessCount = await this.prisma.degreeProcess.count({
      where: {
        advisorId: assignAdvisorDto.advisorUserId,
        status: {
          in: [
            ProcessStatus.ACTIVE,
            ProcessStatus.IN_REVIEW,
            ProcessStatus.APPROVED,
          ],
        },
      },
    });

    const maxAllowed = Math.min(
      this.maxActiveProcessesPerAdvisor,
      advisorProfile.maxActiveProcesses,
    );

    if (activeProcessCount >= maxAllowed) {
      throw new BusinessRuleViolationError(
        `Advisor has reached maximum number of active processes (${maxAllowed})`,
      );
    }

    // Assign advisor
    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedProcess = await tx.degreeProcess.update({
        where: { id: processId },
        data: {
          advisorId: assignAdvisorDto.advisorUserId,
        },
        include: {
          student: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          advisor: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
          modality: { select: { id: true, code: true, name: true } },
        },
      });

      await tx.advisorProfile.update({
        where: { userId: assignAdvisorDto.advisorUserId },
        data: {
          currentActiveProcesses: activeProcessCount + 1,
          isAvailable: activeProcessCount + 1 < maxAllowed,
        },
      });

      return updatedProcess;
    });

    this.logger.log(
      `Advisor ${assignAdvisorDto.advisorUserId} assigned to process ${processId}`,
    );

    // Notify advisor and student about assignment
    try {
      if (updated.advisor && updated.advisor.id) {
        await this.notificationsService.createNotification(
          updated.advisor.id,
          NotificationType.GENERAL,
          'Se te asignó un proceso',
          `Se te asignó el proceso "${updated.title || ''}" del estudiante ${updated.student.firstName} ${updated.student.lastName}.`,
          { processId: updated.id, target: `/process/${updated.id}` },
        );
      }

      await this.notificationsService.createNotification(
        updated.student.id,
        NotificationType.GENERAL,
        'Asesor asignado',
        `Se te asignó el asesor ${updated.advisor.firstName} ${updated.advisor.lastName} para tu proceso.`,
        { processId: updated.id, target: `/process/${updated.id}` },
      );
    } catch (err) {
      this.logger.warn('Failed to create advisor-assignment notifications: ' + err.message);
    }

    return updated;
  }

  /**
   * Activate a process (transition DRAFT → ACTIVE)
   * Student submits inscription
   *
   * @param processId ID of the process
   * @param userId ID of the user activating (student)
   * @returns Updated process
   * @throws NotFoundException if process not found
   * @throws BusinessRuleViolationError if advisor not assigned
   * @throws InvalidStateTransitionError if state transition invalid
   */
  async activateProcess(processId: string, userId: string) {
    this.logger.debug(`Activating process: ${processId}`);

    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID ${processId} not found`);
    }

    if (process.studentId !== userId) {
      throw new ForbiddenException(
        'Only the process owner can activate it',
      );
    }

    // Validate advisor is assigned
    if (!process.advisorId) {
      throw new BusinessRuleViolationError(
        'Advisor must be assigned before activating process',
      );
    }

    // Validate state transition
    try {
      ProcessStateMachine.validateTransition(
        process.status as ProcessStatus,
        ProcessStatus.ACTIVE,
        'STUDENT',
      );
    } catch (error) {
      if (error instanceof DomainError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    // Update status
    const updated = await this.prisma.degreeProcess.update({
      where: { id: processId },
      data: {
        status: ProcessStatus.ACTIVE,
      },
      include: {
        student: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        modality: { select: { id: true, code: true, name: true } },
        advisor: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(`Process activated: ${processId}`);

    // Notify interested parties: advisor and student
    try {
      if (updated.advisor && updated.advisor.id) {
        await this.notificationsService.createNotification(
          updated.advisor.id,
          NotificationType.GENERAL,
          'Proceso activado',
          `El estudiante ${updated.student.firstName} ${updated.student.lastName} activó el proceso "${updated.title || ''}".`,
          { processId: updated.id, target: `/process/${updated.id}` },
        );
      }

      await this.notificationsService.createNotification(
        updated.student.id,
        NotificationType.GENERAL,
        'Proceso enviado',
        `Tu proceso "${updated.title || ''}" ha sido enviado y está en proceso.`,
        { processId: updated.id, target: `/process/${updated.id}` },
      );
    } catch (err) {
      this.logger.warn('Failed to create activation notifications: ' + err.message);
    }

    return updated;
  }

  /**
   * Update process status with state machine validation
   *
   * @param processId ID of the process
   * @param updateStatusDto New status data
   * @param userId ID of the user performing update
   * @param userRole Role of the user
   * @returns Updated process
   * @throws NotFoundException if process not found
   * @throws InvalidStateTransitionError if transition invalid
   * @throws InsufficientPermissionsError if user lacks permission
   */
  async updateProcessStatus(
    processId: string,
    updateStatusDto: UpdateStatusDto,
    userId: string,
    userRole: string,
  ) {
    this.logger.debug(`Updating process status: ${processId}`);

    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID ${processId} not found`);
    }

    // Validate state transition
    try {
      ProcessStateMachine.validateTransition(
        process.status as ProcessStatus,
        updateStatusDto.status,
        userRole,
      );
    } catch (error) {
      if (error instanceof InvalidStateTransitionError) {
        throw new BadRequestException(error.message);
      }
      if (error instanceof InsufficientPermissionsError) {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }

    // Update status
    const updated = await this.prisma.degreeProcess.update({
      where: { id: processId },
      data: {
        status: updateStatusDto.status,
      },
      include: {
        student: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        modality: { select: { id: true, code: true, name: true } },
        advisor: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
    });

    this.logger.log(
      `Process status updated: ${processId} → ${updateStatusDto.status}`,
    );
    return updated;
  }

  /**
   * Finalize a degree process by setting its status to COMPLETED.
   * Only for administrator action.
   */
  async adminFinalizeProcess(processId: string) {
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID ${processId} not found`);
    }

    if (process.status === ProcessStatus.COMPLETED) {
      return process;
    }

    const updated = await this.prisma.degreeProcess.update({
      where: { id: processId },
      data: { status: ProcessStatus.COMPLETED },
      include: {
        student: { select: { id: true, email: true, firstName: true, lastName: true } },
        modality: { select: { id: true, code: true, name: true } },
        advisor: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    this.logger.log(`Process finalized: ${processId}`);
    return updated;
  }

  /**
   * Permanently delete a degree process and related dataset.
   * Only for administrator action.
   */
  async adminDeleteProcess(processId: string) {
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID ${processId} not found`);
    }

    await this.prisma.degreeProcess.delete({
      where: { id: processId },
    });

    this.logger.log(`Process deleted: ${processId}`);
    return { message: `Process ${processId} deleted successfully` };
  }

  /**
   * Get process summary with requirement completion metrics
   *
   * @param processId ID of the process
   * @returns Summary with completion percentages
   * @throws NotFoundException if process not found
   */
  async getProcessSummary(processId: string, userId: string, userRole: string) {
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
      include: {
        requirementInstances: {
          include: { modalityRequirement: true },
        },
      },
    });

    if (!process) {
      throw new NotFoundException(`Process with ID ${processId} not found`);
    }

    // Permission check — same rules as getProcessById
    this.checkAccessPermission(process, userId, userRole);

    const totalRequirements = process.requirementInstances.length;
    const approvedRequirements = process.requirementInstances.filter(
      (r) => r.status === DocumentStatus.APROBADO,
    ).length;
    const completionPercentage =
      totalRequirements > 0
        ? Math.round((approvedRequirements / totalRequirements) * 100)
        : 0;

    const requirementsByStatus = {
      [DocumentStatus.POR_CARGAR]: process.requirementInstances.filter(
        (r) => r.status === DocumentStatus.POR_CARGAR,
      ).length,
      [DocumentStatus.PENDIENTE]: process.requirementInstances.filter(
        (r) => r.status === DocumentStatus.PENDIENTE,
      ).length,
      [DocumentStatus.EN_REVISION]: process.requirementInstances.filter(
        (r) => r.status === DocumentStatus.EN_REVISION,
      ).length,
      [DocumentStatus.EN_CORRECCION]: process.requirementInstances.filter(
        (r) => r.status === DocumentStatus.EN_CORRECCION,
      ).length,
      [DocumentStatus.APROBADO]: approvedRequirements,
      [DocumentStatus.FINALIZADO]: process.requirementInstances.filter(
        (r) => r.status === DocumentStatus.FINALIZADO,
      ).length,
    };

    return {
      processId: process.id,
      status: process.status,
      totalRequirements,
      approvedRequirements,
      completionPercentage,
      requirementsByStatus,
      createdAt: process.createdAt,
      updatedAt: process.updatedAt,
    };
  }

  /**
   * Internal method: Check and auto-transition process based on requirement statuses
   * Automatically transitions process to IN_REVIEW if all requirements are PENDIENTE or EN_REVISION
   * Automatically transitions to APPROVED if all requirements are APROBADO
   *
   * @param processId ID of the process
   */
  async checkAndUpdateProcessStatus(processId: string) {
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
      include: {
        requirementInstances: {
          select: { status: true },
        },
      },
    });

    if (!process) {
      return;
    }

    const requirementInstances = process.requirementInstances;
    if (requirementInstances.length === 0) {
      return;
    }

    const allApproved = requirementInstances.every(
      (r) => r.status === DocumentStatus.APROBADO,
    );
    const allUploaded = requirementInstances.every(
      (r) =>
        r.status !== DocumentStatus.POR_CARGAR &&
        r.status !== DocumentStatus.FINALIZADO,
    );

    try {
      // Auto-transition to APPROVED if all requirements approved
      if (
        allApproved &&
        process.status === ProcessStatus.IN_REVIEW
      ) {
        const updated = await this.prisma.degreeProcess.update({
          where: { id: processId },
          data: {
            status: ProcessStatus.APPROVED,
          },
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            advisor: { select: { id: true, firstName: true, lastName: true } },
          },
        });
 
        this.logger.log(
          `Process auto-transitioned to APPROVED: ${processId}`,
        );

        // Notify student and advisor
        try {
          await this.notificationsService.createNotification(
            updated.student.id,
            NotificationType.GENERAL,
            'Proceso aprobado',
            `Tu proceso "${updated.title || ''}" ha sido aprobado.`,
            { processId: updated.id, target: `/process/${updated.id}` },
          );

          if (updated.advisor && updated.advisor.id) {
            await this.notificationsService.createNotification(
              updated.advisor.id,
              NotificationType.GENERAL,
              'Proceso aprobado',
              `El proceso del estudiante ${updated.student.firstName} ${updated.student.lastName} ha sido aprobado.`,
              { processId: updated.id, target: `/process/${updated.id}` },
            );
          }
        } catch (err) {
          this.logger.warn('Failed to create approval notifications: ' + err.message);
        }
      }
 
      // Auto-transition to IN_REVIEW if all requirements uploaded
      if (
        allUploaded &&
        process.status === ProcessStatus.ACTIVE
      ) {
        const updated = await this.prisma.degreeProcess.update({
          where: { id: processId },
          data: {
            status: ProcessStatus.IN_REVIEW,
          },
          include: {
            student: { select: { id: true, firstName: true, lastName: true } },
            advisor: { select: { id: true, firstName: true, lastName: true } },
          },
        });
 
        this.logger.log(
          `Process auto-transitioned to IN_REVIEW: ${processId}`,
        );

        // Notify student and advisor
        try {
          await this.notificationsService.createNotification(
            updated.student.id,
            NotificationType.GENERAL,
            'Proceso en revisión',
            `Tu proceso "${updated.title || ''}" está listo para revisión.`,
            { processId: updated.id, target: `/process/${updated.id}` },
          );

          if (updated.advisor && updated.advisor.id) {
            await this.notificationsService.createNotification(
              updated.advisor.id,
              NotificationType.GENERAL,
              'Proceso para revisión',
              `El proceso del estudiante ${updated.student.firstName} ${updated.student.lastName} está listo para revisión.`,
              { processId: updated.id, target: `/process/${updated.id}` },
            );
          }
        } catch (err) {
          this.logger.warn('Failed to create in-review notifications: ' + err.message);
        }
      }
    } catch (error) {
      this.logger.warn(
        `Failed to auto-update process status for ${processId}: ${error.message}`,
      );
    }
  }

  /**
   * Helper: Check if user has access to a process based on role and process ownership
   *
   * @param process Degree process
   * @param userId User ID
   * @param userRole User role
   * @throws ForbiddenException if user lacks access
   */
  private checkAccessPermission(
    process: any,
    userId: string,
    userRole: string,
  ): void {
    const isStudent = process.studentId === userId && userRole === 'STUDENT';
    const isAdvisor = process.advisorId === userId && userRole === 'ADVISOR';
    const isStaff = ['SECRETARY', 'ADMIN', 'SUPERADMIN'].includes(userRole);

    if (!isStudent && !isAdvisor && !isStaff) {
      throw new ForbiddenException(
        'You do not have permission to access this process',
      );
    }
  }
}
