import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { SharedModule } from '../../shared/shared.module';

@Module({
  imports: [
    SharedModule,
    HttpModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        baseURL: configService.get<string>('ITP_API_BASE_URL', 'https://api.example.com'),
        timeout: configService.get<number>('ITP_API_TIMEOUT', 10000),
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    }),
  ],
  providers: [IntegrationService],
  controllers: [IntegrationController],
  exports: [IntegrationService],
})
export class IntegrationModule {}
