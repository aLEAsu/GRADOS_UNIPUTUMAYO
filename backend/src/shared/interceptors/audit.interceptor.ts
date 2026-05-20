import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';

/**
 * Metadata keys for routes that should be audited to the database.
 * Only mutating operations (POST, PUT, PATCH, DELETE) are persisted.
 * GET requests are only logged to console for debugging.
 */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    @Inject(AuditService) private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const startTime = Date.now();
    const user = request.user as { sub?: string; role?: string } | undefined;
    const ipAddress =
      request.ip ||
      request.connection?.remoteAddress ||
      request.headers['x-forwarded-for']?.toString() ||
      'unknown';
    const userAgent: string = request.headers['user-agent'] || 'unknown';
    const method: string = request.method;
    const path: string = request.url;
    const action = `${method} ${path}`;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode: number = response.statusCode || 200;

          this.logger.debug(
            `[${action}] User=${user?.sub || 'ANON'} Role=${user?.role || 'N/A'} Status=${statusCode} ${duration}ms`,
          );

          // Persist mutating operations to DB asynchronously (fire-and-forget)
          if (MUTATING_METHODS.has(method) && user?.sub) {
            this.persistAuditEvent(user, action, path, ipAddress, userAgent, request.params).catch(
              (err) => this.logger.warn(`Audit persist failed: ${err.message}`),
            );
          }
        },
        error: (error: { status?: number; message?: string }) => {
          const duration = Date.now() - startTime;
          const statusCode = error.status || 500;

          this.logger.warn(
            `[${action}] User=${user?.sub || 'ANON'} Role=${user?.role || 'N/A'} Status=${statusCode} ${duration}ms Error=${error.message}`,
          );

          // Persist errors for important operations
          if (MUTATING_METHODS.has(method) && statusCode >= 400) {
            this.persistAuditEvent(
              user,
              `ERROR:${action}`,
              path,
              ipAddress,
              userAgent,
              request.params,
              { error: error.message, statusCode },
            ).catch((err) => this.logger.warn(`Audit persist failed: ${err.message}`));
          }
        },
      }),
    );
  }

  /**
   * Fire-and-forget persist to DB. Never blocks the main request.
   */
  private async persistAuditEvent(
    user: { sub?: string; role?: string } | undefined,
    action: string,
    path: string,
    ipAddress: string,
    userAgent: string,
    params?: Record<string, string>,
    errorData?: Record<string, unknown>,
  ): Promise<void> {
    // Extract entity and entityId from route params
    const entity = this.extractEntity(path);
    const entityId = params?.id || params?.entityId || 'N/A';

    await this.auditService.logEvent({
      userId: user?.sub,
      userRole: user?.role,
      action,
      entity,
      entityId,
      ipAddress,
      userAgent,
      newValue: errorData,
    });
  }

  /**
   * Extract entity name from URL path (e.g., /api/v1/degree-processes/123 → degree-processes)
   */
  private extractEntity(path: string): string {
    const segments = path.replace(/^\/api\/v1\//, '').split('/');
    return segments[0] || 'unknown';
  }
}
