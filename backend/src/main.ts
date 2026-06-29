import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';
import { AuditInterceptor } from './shared/interceptors/audit.interceptor';
import { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const appConfig = configService.get<AppConfig>('app');
  const logger = new Logger('Bootstrap');

  // Validate critical environment variables at startup
  const jwtAccessSecret = configService.get<string>('jwt.accessSecret');
  if (!jwtAccessSecret || jwtAccessSecret.includes('change')) {
    logger.warn('⚠️  JWT_ACCESS_SECRET is not set or uses default value. Change it for production!');
  }

  // Security middleware
  app.use(helmet());
  app.use(cookieParser());

  // CORS configuration
  app.enableCors({
    origin: appConfig?.corsOrigin || 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Global validation pipe with UUID support
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global audit interceptor (DI-based — resolved from container)
  const auditInterceptor = app.get(AuditInterceptor);
  app.useGlobalInterceptors(auditInterceptor);

  // Swagger configuration
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Plataforma Grados ITP - API')
    .setDescription('API documentation for the degree processing platform')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'bearer',
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('degree-process', 'Degree processing endpoints')
    .addTag('documents', 'Document management endpoints')
    .addTag('reviews', 'Review endpoints')
    .addTag('signatures', 'Digital signature endpoints')
    .addTag('notifications', 'Notification endpoints')
    .addTag('admin', 'Administration endpoints')
    .addTag('audit', 'Audit log endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = appConfig?.port || 3000;
  await app.listen(port, '0.0.0.0');

  logger.log(`Application is running on port ${port}`);
  logger.log(`Environment: ${appConfig?.environment}`);
  logger.log(`Swagger documentation available at http://localhost:${port}/api/docs`);
  logger.log(`API base URL: http://localhost:${port}/api/v1`);
}

bootstrap().catch((error) => {
  const logger = new Logger('Bootstrap');
  logger.error('Failed to start application', error);
  process.exit(1);
});
