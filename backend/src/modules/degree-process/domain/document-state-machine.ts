/**
 * Document State Machine
 * Pure TypeScript - no external dependencies or framework decorators
 * Manages the lifecycle states of requirements/documents in a degree process
 *
 * State flow:
 *   POR_CARGAR → PENDIENTE (student uploads)
 *   PENDIENTE → EN_REVISION (secretary sends to review)
 *   EN_REVISION → EN_CORRECCION (advisor returns with observations)
 *   EN_REVISION → APROBADO (secretary approves AFTER advisor approval + signature)
 *   EN_CORRECCION → PENDIENTE (student uploads corrected version)
 *   APROBADO → FINALIZADO (secretary finalizes when process completes)
 */

import {
  InvalidStateTransitionError,
  InsufficientPermissionsError,
} from './errors';

export enum DocumentStatus {
  POR_CARGAR = 'POR_CARGAR',
  PENDIENTE = 'PENDIENTE',
  EN_REVISION = 'EN_REVISION',
  EN_CORRECCION = 'EN_CORRECCION',
  APROBADO = 'APROBADO',
  FINALIZADO = 'FINALIZADO',
}

/**
 * Each transition is defined individually: origin → destination with allowed roles
 * This allows different roles for different transitions from the SAME origin state
 */
interface Transition {
  from: DocumentStatus;
  to: DocumentStatus;
  allowedRoles: string[];
  conditions: string[];
}

export class DocumentStateMachine {
  /**
   * All valid transitions defined individually.
   * This fixes the limitation of grouping by origin state,
   * allowing EN_REVISION → EN_CORRECCION (ADVISOR) and EN_REVISION → APROBADO (SECRETARY)
   */
  private static readonly TRANSITIONS: Transition[] = [
    {
      from: DocumentStatus.POR_CARGAR,
      to: DocumentStatus.PENDIENTE,
      allowedRoles: ['STUDENT'],
      conditions: ['Student has uploaded a document version'],
    },
    {
      from: DocumentStatus.PENDIENTE,
      to: DocumentStatus.EN_REVISION,
      allowedRoles: ['SECRETARY', 'ADMIN', 'SUPERADMIN'],
      conditions: ['Secretary verifies payment if applicable and sends to review'],
    },
    {
      from: DocumentStatus.EN_REVISION,
      to: DocumentStatus.EN_CORRECCION,
      allowedRoles: ['ADVISOR', 'SECRETARY', 'ADMIN', 'SUPERADMIN'],
      conditions: ['Advisor returns document with mandatory observations'],
    },
    {
      from: DocumentStatus.EN_REVISION,
      to: DocumentStatus.APROBADO,
      allowedRoles: ['SECRETARY', 'ADMIN', 'SUPERADMIN'],
      conditions: [
        'Academic approval (ADVISOR) must exist for this version',
        'Digital signature must be applied',
      ],
    },
    {
      from: DocumentStatus.EN_CORRECCION,
      to: DocumentStatus.PENDIENTE,
      allowedRoles: ['STUDENT'],
      conditions: ['Student has uploaded a corrected version'],
    },
    {
      from: DocumentStatus.EN_CORRECCION,
      to: DocumentStatus.EN_REVISION,
      allowedRoles: ['STUDENT'],
      conditions: [
        'Student has uploaded a corrected version',
        'Auto-transition: correction re-uploads go directly to review',
      ],
    },
    {
      from: DocumentStatus.APROBADO,
      to: DocumentStatus.FINALIZADO,
      allowedRoles: ['SECRETARY', 'ADMIN', 'SUPERADMIN'],
      conditions: ['All mandatory requirements in the process are approved'],
    },
  ];

  /**
   * Check if a specific transition is allowed for a given role
   */
  static canTransition(
    currentStatus: DocumentStatus,
    nextStatus: DocumentStatus,
    userRole: string,
  ): boolean {
    return this.TRANSITIONS.some(
      (t) =>
        t.from === currentStatus &&
        t.to === nextStatus &&
        t.allowedRoles.includes(userRole),
    );
  }

  /**
   * Get all available transitions from a given status for a specific role
   */
  static getAvailableTransitions(
    currentStatus: DocumentStatus,
    userRole: string,
  ): DocumentStatus[] {
    return this.TRANSITIONS.filter(
      (t) => t.from === currentStatus && t.allowedRoles.includes(userRole),
    ).map((t) => t.to);
  }

  /**
   * Validate a transition and throw descriptive error if invalid
   */
  static validateTransition(
    currentStatus: DocumentStatus,
    nextStatus: DocumentStatus,
    userRole: string,
  ): void {
    // Check if the transition path exists at all (regardless of role)
    const transitionExists = this.TRANSITIONS.some(
      (t) => t.from === currentStatus && t.to === nextStatus,
    );

    if (!transitionExists) {
      throw new InvalidStateTransitionError(
        currentStatus,
        nextStatus,
        userRole,
      );
    }

    // Check if this role can perform this specific transition
    const roleAllowed = this.TRANSITIONS.some(
      (t) =>
        t.from === currentStatus &&
        t.to === nextStatus &&
        t.allowedRoles.includes(userRole),
    );

    if (!roleAllowed) {
      const matchingTransition = this.TRANSITIONS.find(
        (t) => t.from === currentStatus && t.to === nextStatus,
      );
      throw new InsufficientPermissionsError(
        userRole,
        matchingTransition?.allowedRoles || [],
      );
    }
  }

  /**
   * Get conditions required for a specific transition
   */
  static getTransitionConditions(
    currentStatus: DocumentStatus,
    nextStatus: DocumentStatus,
  ): string[] {
    const transition = this.TRANSITIONS.find(
      (t) => t.from === currentStatus && t.to === nextStatus,
    );
    return transition?.conditions || [];
  }

  /**
   * Get all valid statuses
   */
  static getAllStatuses(): DocumentStatus[] {
    return Object.values(DocumentStatus);
  }

  /**
   * Check if a status is a terminal state (no further transitions possible)
   */
  static isTerminalStatus(status: DocumentStatus): boolean {
    return !this.TRANSITIONS.some((t) => t.from === status);
  }

  /**
   * Get the full transition map for documentation/debugging
   */
  static getTransitionMap(): Transition[] {
    return [...this.TRANSITIONS];
  }
}
