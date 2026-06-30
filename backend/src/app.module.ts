import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import appConfig, {
  jwtConfig,
  googleOAuthConfig,
  mailConfig,
  signaturesConfig,
  throttleConfig,
} from './config/app.config';
import { SharedModule } from './shared/shared.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DegreeProcessModule } from './modules/degree-process/degree-process.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { SignaturesModule } from './modules/signatures/signatures.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { AuditModule } from './modules/audit/audit.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthController } from './health.controller';
import { SeedController } from './seed.controller'; // ← agregar

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development',
      isGlobal: true,
      load: [appConfig, jwtConfig, googleOAuthConfig, mailConfig, signaturesConfig, throttleConfig],
    }),
  
    // Scheduled tasks (session cleanup, etc.)
    ScheduleModule.forRoot(),

    // Rate limiting
    ThrottlerModule.forRootAsync({
      useFactory: () => ([{
        ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
      }]),
    }),

    SharedModule,

    // Core Feature Modules
    AuthModule,
    UsersModule,
    DegreeProcessModule,
    DocumentsModule,
    ReviewsModule,
    SignaturesModule,
    NotificationsModule,
    IntegrationModule,
    AuditModule,
    AdminModule,
  ],
  controllers: [HealthController, SeedController], // ← agregar SeedController
  providers: [],
})
export class AppModule {}
