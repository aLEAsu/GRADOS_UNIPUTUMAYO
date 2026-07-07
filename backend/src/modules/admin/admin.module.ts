import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { FileValidationPipe } from '../documents/pipes/file-validation.pipe';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    ConfigModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        storage: memoryStorage(),
        limits: {
          fileSize: configService.get<number>('app.maxFileSize') || 52428800,
        },
      }),
    }),
    SharedModule,
  ],
  providers: [AdminService, FileValidationPipe],
  controllers: [AdminController],
  exports: [AdminService],
})
export class AdminModule {}
