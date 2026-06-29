/* signatures.module.ts */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SignaturesService } from './signatures.service';
import { SignaturesController } from './signatures.controller';
import { SharedModule } from '../../shared/shared.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: 5 * 1024 * 1024, // 5MB max for signature images
        },
      }),
    }),
    SharedModule,
    NotificationsModule,
  ],
  providers: [SignaturesService],
  controllers: [SignaturesController],
  exports: [SignaturesService],
})
export class SignaturesModule {}
