import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../shared/prisma/prisma.service';

/**
 * Scheduled service to clean up expired and inactive sessions.
 * Runs every day at 3:00 AM to prevent the sessions table from growing indefinitely.
 */
@Injectable()
export class SessionCleanupService {
  private readonly logger = new Logger(SessionCleanupService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Delete expired and inactive sessions daily at 3 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredSessions(): Promise<void> {
    this.logger.log('Starting session cleanup...');

    try {
      // Delete sessions that are expired OR have been inactive
      const result = await this.prisma.session.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { isActive: false },
          ],
        },
      });

      this.logger.log(`Session cleanup complete: ${result.count} sessions removed`);
    } catch (error) {
      this.logger.error(`Session cleanup failed: ${(error as Error).message}`);
    }
  }

  /**
   * Manual cleanup - can be triggered via admin endpoint
   */
  async manualCleanup(): Promise<{ removedCount: number }> {
    const result = await this.prisma.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isActive: false },
        ],
      },
    });

    this.logger.log(`Manual session cleanup: ${result.count} sessions removed`);
    return { removedCount: result.count };
  }
}
