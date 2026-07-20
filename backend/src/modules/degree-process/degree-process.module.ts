import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DegreeProcessService } from './degree-process.service';
import { DegreeProcessController } from './degree-process.controller';
import { SharedModule } from '../../shared/shared.module';
import { IntegrationModule } from '../integration/integration.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Degree Process Module
 * Core aggregate root module for managing student inscriptions to degree modalities
 *
 * Features:
 * - State machine-driven process and document lifecycle management
 * - Role-based access control and permission validation
 * - Requirement tracking and automatic status transitions
 * - Complete audit trail with status history
 */
@Module({
  imports: [
    ConfigModule,
    SharedModule, // Provides PrismaService, guards, decorators, etc.
    IntegrationModule,
    // Notifications used to create alerts for process lifecycle events
    NotificationsModule,
  ],
  providers: [DegreeProcessService],
  controllers: [DegreeProcessController],
  exports: [DegreeProcessService], // Export for use in other modules
})
export class DegreeProcessModule {}
