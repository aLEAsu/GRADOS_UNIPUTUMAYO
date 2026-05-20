import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { StorageService } from './storage/storage.service';
import { PaginationService } from './pagination/pagination.service';
import { AuditInterceptor } from './interceptors/audit.interceptor';

@Global()
@Module({
  providers: [PrismaService, StorageService, PaginationService, AuditInterceptor],
  exports: [PrismaService, StorageService, PaginationService, AuditInterceptor],
})
export class SharedModule {}
