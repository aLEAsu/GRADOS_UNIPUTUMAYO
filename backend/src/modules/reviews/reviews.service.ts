import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  BusinessRuleViolationError,
  InsufficientPermissionsError,
} from '../degree-process/domain/errors';
import {
  DocumentStatus,
} from '../degree-process/domain/document-state-machine';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { CreateObservationDto } from './dto/create-observation.dto';
import { ApprovalDecision, ApprovalType } from '@prisma/client';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create an academic approval (by advisor)
   * Validates requirement is EN_REVISION and advisor is assigned
   * APPROVED: creates Approval with type ACADEMIC
   * REVISION_REQUESTED: creates Approval + Observation, transitions to EN_CORRECCION
   */
  async createAcademicApproval(
    requirementInstanceId: string,
    advisorUserId: string,
    dto: CreateApprovalDto,
  ) {
    // Validate requirement exists and get its details
    const requirement = await this.prisma.requirementInstance.findUnique({
      where: { id: requirementInstanceId },
      include: {
        degreeProcess: true,
        documentVersions: {
          where: { id: dto.documentVersionId },
        },
      },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement instance not found');
    }

    if (!requirement.documentVersions.length) {
      throw new NotFoundException('Document version not found');
    }

    // Validate requirement is EN_REVISION
    if (requirement.status !== DocumentStatus.EN_REVISION) {
      throw new BadRequestException(
        `Requirement must be in EN_REVISION status to create academic approval. Current status: ${requirement.status}`,
      );
    }

    // Validate advisor is assigned to this process
    if (requirement.degreeProcess.advisorId !== advisorUserId) {
      throw new InsufficientPermissionsError('ADVISOR', ['ASSIGNED_ADVISOR']);
    }

    this.validateObservationForNonApproval(dto);

    // Use transaction to ensure atomicity
    const approval = await this.prisma.$transaction(async (tx) => {
      // Create the approval
      const createdApproval = await tx.approval.create({
        data: {
          requirementInstanceId,
          documentVersionId: dto.documentVersionId,
          approverUserId: advisorUserId,
          type: ApprovalType.ACADEMIC,
          decision: dto.decision,
          observations: dto.observations,
          approvedAt: new Date(),
        },
        include: {
          approverUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });

      // If decision is REVISION_REQUESTED, create observation and transition to EN_CORRECCION
      if (
        dto.decision === ApprovalDecision.REVISION_REQUESTED ||
        dto.decision === ApprovalDecision.REJECTED
      ) {
        // Create observation
        await tx.observation.create({
          data: {
            requirementInstanceId,
            documentVersionId: dto.documentVersionId,
            authorId: advisorUserId,
            content:
              dto.observations ||
              (dto.decision === ApprovalDecision.REJECTED
                ? 'Document rejected by advisor'
                : 'Revision requested by advisor'),
          },
        });

        // Transition to EN_CORRECCION
        await tx.requirementInstance.update({
          where: { id: requirementInstanceId },
          data: {
            status: DocumentStatus.EN_CORRECCION,
          },
        });
      }

      return createdApproval;
    });

    return approval;
  }

  /**
   * Create an administrative approval (by secretary)
   * CRITICAL RULE: Validate that ACADEMIC approval with decision=APPROVED exists
   * APPROVED: creates Approval with type ADMINISTRATIVE, transitions to APROBADO
   * REVISION_REQUESTED: creates Observation, transitions to EN_CORRECCION
   */
  async createAdministrativeApproval(
    requirementInstanceId: string,
    secretaryUserId: string,
    dto: CreateApprovalDto,
  ) {
    this.validateObservationForNonApproval(dto);

    // Validate requirement exists
    const requirement = await this.prisma.requirementInstance.findUnique({
      where: { id: requirementInstanceId },
      include: {
        degreeProcess: {
          include: {
            requirementInstances: {
              select: { id: true, status: true },
            },
          },
        },
        documentVersions: {
          where: { id: dto.documentVersionId },
        },
      },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement instance not found');
    }

    if (!requirement.documentVersions.length) {
      throw new NotFoundException('Document version not found');
    }

    // Validate requirement is EN_REVISION
    if (requirement.status !== DocumentStatus.EN_REVISION) {
      throw new BadRequestException(
        `Requirement must be in EN_REVISION status to create administrative approval. Current status: ${requirement.status}`,
      );
    }

    // CRITICAL RULE: Check that an ACADEMIC approval with decision=APPROVED exists
    // for the SAME document version being approved (not an old version)
    const academicApproval = await this.prisma.approval.findFirst({
      where: {
        requirementInstanceId,
        documentVersionId: dto.documentVersionId,
        type: ApprovalType.ACADEMIC,
        decision: ApprovalDecision.APPROVED,
      },
    });

    if (!academicApproval) {
      throw new BusinessRuleViolationError(
        'La secretaría no puede aprobar sin aprobación académica previa del asesor para esta versión del documento',
      );
    }

    // Use transaction to ensure atomicity
    const approval = await this.prisma.$transaction(async (tx) => {
      // Create the approval
      const createdApproval = await tx.approval.create({
        data: {
          requirementInstanceId,
          documentVersionId: dto.documentVersionId,
          approverUserId: secretaryUserId,
          type: ApprovalType.ADMINISTRATIVE,
          decision: dto.decision,
          observations: dto.observations,
          approvedAt: new Date(),
        },
        include: {
          approverUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      });

      // If decision is APPROVED, transition to APROBADO
      if (dto.decision === ApprovalDecision.APPROVED) {
        await tx.requirementInstance.update({
          where: { id: requirementInstanceId },
          data: {
            status: DocumentStatus.APROBADO,
          },
        });

        const allRequirementsApproved = requirement.degreeProcess.requirementInstances.every(
          (r) =>
            r.id === requirementInstanceId ||
            r.status === DocumentStatus.APROBADO ||
            r.status === DocumentStatus.FINALIZADO,
        );

        if (
          allRequirementsApproved &&
          requirement.degreeProcess.status === 'IN_REVIEW'
        ) {
          await tx.degreeProcess.update({
            where: { id: requirement.degreeProcessId },
            data: { status: 'APPROVED' },
          });
        }
      } else if (
        dto.decision === ApprovalDecision.REVISION_REQUESTED ||
        dto.decision === ApprovalDecision.REJECTED
      ) {
        // If decision is REVISION_REQUESTED, create observation and transition to EN_CORRECCION
        await tx.observation.create({
          data: {
            requirementInstanceId,
            documentVersionId: dto.documentVersionId,
            authorId: secretaryUserId,
            content:
              dto.observations ||
              (dto.decision === ApprovalDecision.REJECTED
                ? 'Document rejected by secretary'
                : 'Revision requested by secretary'),
          },
        });

        await tx.requirementInstance.update({
          where: { id: requirementInstanceId },
          data: {
            status: DocumentStatus.EN_CORRECCION,
          },
        });
      }

      return createdApproval;
    });

    return approval;
  }

  /**
   * Send a requirement to review
   * Validates requirement is PENDIENTE and user has SECRETARY or ADMIN role
   * Transitions to EN_REVISION
   */
  async sendToReview(requirementInstanceId: string) {
    const requirement = await this.prisma.requirementInstance.findUnique({
      where: { id: requirementInstanceId },
      include: {
        degreeProcess: {
          include: {
            requirementInstances: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement instance not found');
    }

    if (requirement.status !== DocumentStatus.PENDIENTE) {
      throw new BadRequestException(
        `Requirement must be in PENDIENTE status to send to review. Current status: ${requirement.status}`,
      );
    }

    if (
      requirement.degreeProcess.status !== 'ACTIVE' &&
      requirement.degreeProcess.status !== 'IN_REVIEW'
    ) {
      throw new BusinessRuleViolationError(
        `Los documentos solo pueden enviarse a revisión cuando el proceso de grado está activo (ACTIVE o IN_REVIEW). Estado actual del proceso: ${requirement.degreeProcess.status}. El estudiante debe activar el proceso antes de que se puedan enviar documentos a revisión.`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.requirementInstance.update({
        where: { id: requirementInstanceId },
        data: {
          status: DocumentStatus.EN_REVISION,
        },
      });

      const allRequirementsInReview = requirement.degreeProcess.requirementInstances.every(
        (r) =>
          r.id === requirementInstanceId ||
          r.status === DocumentStatus.EN_REVISION ||
          r.status === DocumentStatus.APROBADO ||
          r.status === DocumentStatus.FINALIZADO,
      );

      if (
        allRequirementsInReview &&
        requirement.degreeProcess.status === 'ACTIVE'
      ) {
        await tx.degreeProcess.update({
          where: { id: requirement.degreeProcessId },
          data: { status: 'IN_REVIEW' },
        });
      }

      return updated;
    });
  }

  /**
   * Get all approvals for a requirement
   */
  async getApprovalsByRequirement(requirementInstanceId: string) {
    const requirement = await this.prisma.requirementInstance.findUnique({
      where: { id: requirementInstanceId },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement instance not found');
    }

    return this.prisma.approval.findMany({
      where: { requirementInstanceId },
      include: {
        approverUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        documentVersion: {
          select: {
            id: true,
            versionNumber: true,
            fileName: true,
            uploadedAt: true,
          },
        },
      },
      orderBy: { approvedAt: 'desc' },
    });
  }

  /**
   * Get all approvals grouped by requirement for a process
   */
  async getApprovalsByProcess(processId: string) {
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
      include: {
        requirementInstances: true,
      },
    });

    if (!process) {
      throw new NotFoundException('Degree process not found');
    }

    const requirementIds = process.requirementInstances.map((r) => r.id);

    const approvals = await this.prisma.approval.findMany({
      where: {
        requirementInstanceId: {
          in: requirementIds,
        },
      },
      include: {
        approverUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        documentVersion: {
          select: {
            id: true,
            versionNumber: true,
            fileName: true,
            uploadedAt: true,
          },
        },
        requirementInstance: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { approvedAt: 'desc' },
    });

    // Group by requirement
    const grouped = approvals.reduce(
      (acc, approval) => {
        const reqId = approval.requirementInstanceId;
        if (!acc[reqId]) {
          acc[reqId] = [];
        }
        acc[reqId].push(approval);
        return acc;
      },
      {} as Record<string, typeof approvals>,
    );

    return grouped;
  }

  /**
   * Add observation for a requirement
   */
  async addObservation(
    requirementInstanceId: string,
    authorUserId: string,
    dto: CreateObservationDto,
  ) {
    const requirement = await this.prisma.requirementInstance.findUnique({
      where: { id: requirementInstanceId },
    });

    if (!requirement) {
      throw new NotFoundException('Requirement instance not found');
    }

    if (dto.documentVersionId) {
      const documentVersion = await this.prisma.documentVersion.findUnique({
        where: { id: dto.documentVersionId },
      });

      if (!documentVersion) {
        throw new NotFoundException('Document version not found');
      }
    }

    return this.prisma.observation.create({
      data: {
        requirementInstanceId,
        documentVersionId: dto.documentVersionId,
        authorId: authorUserId,
        content: dto.content,
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Resolve an observation
   */
  async resolveObservation(observationId: string) {
    const observation = await this.prisma.observation.findUnique({
      where: { id: observationId },
    });

    if (!observation) {
      throw new NotFoundException('Observation not found');
    }

    if (observation.isResolved) {
      throw new BadRequestException('Observation is already resolved');
    }

    return this.prisma.observation.update({
      where: { id: observationId },
      data: {
        isResolved: true,
        resolvedAt: new Date(),
      },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  /**
   * Get all requirements EN_REVISION assigned to an advisor
   */
  async getPendingReviews(advisorUserId: string) {
    return this.prisma.requirementInstance.findMany({
      where: {
        status: DocumentStatus.EN_REVISION,
        degreeProcess: {
          advisorId: advisorUserId,
        },
      },
      include: {
        degreeProcess: {
          select: {
            id: true,
            student: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            modality: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        modalityRequirement: {
          select: {
            id: true,
            documentType: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        documentVersions: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { uploadedAt: 'desc' },
        },
        approvals: {
          include: {
            approverUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        observations: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  /**
   * Get all requirements EN_REVISION that already have academic approval
   * for the LATEST document version (ready for admin approval)
   */
  async getPendingAdminReviews() {
    // Get all requirements in EN_REVISION status with their latest document version
    const requirements = await this.prisma.requirementInstance.findMany({
      where: {
        status: DocumentStatus.EN_REVISION,
      },
      select: {
        id: true,
        documentVersions: {
          orderBy: { uploadedAt: 'desc' },
          take: 1,
          select: { id: true },
        },
      },
    });

    // Build a map of requirementId -> latestDocumentVersionId
    const reqLatestVersionMap = new Map<string, string>();
    for (const req of requirements) {
      if (req.documentVersions.length > 0) {
        reqLatestVersionMap.set(req.id, req.documentVersions[0].id);
      }
    }

    const requirementIds = requirements.map((r) => r.id);

    // Check which ones have ACADEMIC approval with APPROVED decision
    // for ANY version (we'll filter by latest version below)
    const approvals = await this.prisma.approval.findMany({
      where: {
        requirementInstanceId: {
          in: requirementIds,
        },
        type: ApprovalType.ACADEMIC,
        decision: ApprovalDecision.APPROVED,
      },
      select: {
        requirementInstanceId: true,
        documentVersionId: true,
      },
    });

    // Only include requirements where the academic approval is for the LATEST version
    const readyForAdminIds = approvals
      .filter((a) => {
        const latestVersionId = reqLatestVersionMap.get(a.requirementInstanceId);
        return latestVersionId && a.documentVersionId === latestVersionId;
      })
      .map((a) => a.requirementInstanceId);

    // Deduplicate
    const uniqueReadyIds = [...new Set(readyForAdminIds)];

    // Get full details for ready requirements
    return this.prisma.requirementInstance.findMany({
      where: {
        id: {
          in: uniqueReadyIds,
        },
      },
      include: {
        degreeProcess: {
          select: {
            id: true,
            student: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            advisor: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            modality: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        modalityRequirement: {
          select: {
            id: true,
            documentType: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        documentVersions: {
          include: {
            uploadedBy: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: { uploadedAt: 'desc' },
        },
        approvals: {
          include: {
            approverUser: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        observations: {
          include: {
            author: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  private validateObservationForNonApproval(dto: CreateApprovalDto): void {
    if (
      dto.decision !== ApprovalDecision.APPROVED &&
      !dto.observations?.trim()
    ) {
      throw new BadRequestException(
        'Observations are required when requesting corrections or rejecting a document',
      );
    }
  }
}
