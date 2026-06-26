/* signatures.controller.ts */
import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiBody,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { SignaturesService } from './signatures.service';
import {
  SignDocumentDto,
  SignProcessDto,
  CreateSignatureImageDto,
  UpdateSignatureImageDto,
  CreateSignatureConfigDto,
  UpdateSignatureConfigDto,
} from './dto/sign-document.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, UserRole } from '../../shared/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../shared/decorators/current-user.decorator';

@ApiTags('Digital Signatures')
@Controller('signatures')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SignaturesController {
  constructor(private signaturesService: SignaturesService) {}

  // =============================================
  // SIGNATURE IMAGES (Admin manages)
  // =============================================

  @Post('images')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Subir imagen de firma para un usuario' })
  @ApiResponse({ status: 201, description: 'Imagen de firma creada' })
  async createSignatureImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateSignatureImageDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.signaturesService.createSignatureImage(dto, file, user.sub);
  }

  @Put('images/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Actualizar imagen de firma' })
  async updateSignatureImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateSignatureImageDto,
  ) {
    return this.signaturesService.updateSignatureImage(id, dto, file);
  }

  @Get('images')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar todas las imágenes de firma' })
  async getAllSignatureImages() {
    return this.signaturesService.getAllSignatureImages();
  }

  @Get('images/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener imagen de firma por ID' })
  async getSignatureImageById(@Param('id') id: string) {
    return this.signaturesService.getSignatureImageById(id);
  }

  @Get('images/:id/file')
  @ApiOperation({ summary: 'Descargar archivo de imagen de firma' })
  async downloadSignatureImageFile(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const result = await this.signaturesService.getSignatureImageFile(id);
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `inline; filename="${result.fileName}"`,
    });
    res.send(result.buffer);
  }

  @Delete('images/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Eliminar imagen de firma' })
  async deleteSignatureImage(@Param('id') id: string) {
    return this.signaturesService.deleteSignatureImage(id);
  }

  // =============================================
  // SIGNATURE CONFIGS
  // =============================================

  @Post('configs')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Crear configuración de firma para un tipo de documento' })
  @ApiResponse({ status: 201, description: 'Configuración creada' })
  async createSignatureConfig(@Body() dto: CreateSignatureConfigDto) {
    return this.signaturesService.createSignatureConfig(dto);
  }

  @Put('configs/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Actualizar configuración de firma' })
  async updateSignatureConfig(
    @Param('id') id: string,
    @Body() dto: UpdateSignatureConfigDto,
  ) {
    return this.signaturesService.updateSignatureConfig(id, dto);
  }

  @Get('configs')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar todas las configuraciones de firma' })
  async getAllSignatureConfigs() {
    return this.signaturesService.getAllSignatureConfigs();
  }

  @Get('configs/document-type/:documentTypeId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener configuraciones de firma por tipo de documento' })
  async getSignatureConfigsByDocumentType(
    @Param('documentTypeId') documentTypeId: string,
  ) {
    return this.signaturesService.getSignatureConfigsByDocumentType(documentTypeId);
  }

  @Delete('configs/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Eliminar configuración de firma' })
  async deleteSignatureConfig(@Param('id') id: string) {
    return this.signaturesService.deleteSignatureConfig(id);
  }

  // =============================================
  // PROCESS SIGNING (BULK)
  // =============================================

  @Get('processes/ready')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar procesos listos para firmar (estado APPROVED)' })
  async getProcessesReadyForSigning() {
    return this.signaturesService.getProcessesReadyForSigning();
  }

  @Post('processes/sign')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Firmar todos los documentos de un proceso',
    description:
      'Aplica firmas visuales a todos los PDFs del proceso. Requiere que TODOS los documentos tengan configuración de firma.',
  })
  async signProcess(
    @Body() dto: SignProcessDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.signaturesService.signProcess(dto.processId, user.sub, req.ip);
  }

  @Post('processes/:processId/requirements/:requirementInstanceId/sign')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Firmar un documento individual de un proceso',
    description: 'Firma un solo requisito dentro de un proceso APPROVED.',
  })
  @ApiParam({ name: 'processId', description: 'ID del proceso' })
  @ApiParam({ name: 'requirementInstanceId', description: 'ID del requisito a firmar' })
  async signSingleRequirement(
    @Param('processId') processId: string,
    @Param('requirementInstanceId') requirementInstanceId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.signaturesService.signSingleRequirement(processId, requirementInstanceId, user.sub, req.ip);
  }

  @Post('processes/sign-all')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Firmar TODOS los procesos listos (operación masiva)',
    description: 'Itera todos los procesos en estado APPROVED y firma sus documentos.',
  })
  async signAllReadyProcesses(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.signaturesService.signAllReadyProcesses(user.sub, req.ip);
  }

  @Get('processes/:processId/validate')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Validar configuraciones de firma de un proceso' })
  @ApiParam({ name: 'processId', description: 'ID del proceso a validar' })
  async validateProcessConfigs(@Param('processId') processId: string) {
    return this.signaturesService.validateProcessConfigs(processId);
  }

  // =============================================
  // SIGNED DOCUMENT DOWNLOAD
  // =============================================

  @Get('download/:requirementInstanceId')
  @ApiOperation({ summary: 'Descargar documento firmado por requirementInstanceId' })
  async downloadSignedDocument(
    @Param('requirementInstanceId') requirementInstanceId: string,
    @Res() res: Response,
  ) {
    const result = await this.signaturesService.downloadSignedDocument(requirementInstanceId);
    res.set({
      'Content-Type': result.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.fileName)}"`,
      'Content-Length': result.buffer.length.toString(),
    });
    res.send(result.buffer);
  }

  // =============================================
  // LEGACY / EXISTING ENDPOINTS
  // =============================================

  @Post('sign')
  @Roles(UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Firmar un documento individual (legacy)' })
  async signDocument(
    @Body() dto: SignDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return await this.signaturesService.signDocument(
      dto.requirementInstanceId,
      dto.documentVersionId,
      user.sub,
    );
  }

  @Get('verify/:signatureId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verificar una firma digital' })
  async verifySignature(@Param('signatureId') signatureId: string) {
    return await this.signaturesService.verifySignature(signatureId);
  }

  @Get('process/:processId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener todas las firmas de un proceso' })
  async getSignaturesByProcess(@Param('processId') processId: string) {
    return await this.signaturesService.getSignaturesByProcess(processId);
  }

  @Get('requirement/:requirementInstanceId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener firmas de un requisito específico' })
  async getSignaturesByDocument(
    @Param('requirementInstanceId') requirementInstanceId: string,
  ) {
    return await this.signaturesService.getSignaturesByDocument(requirementInstanceId);
  }

  @Post('generate-keys')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generar par de llaves RSA institucional (solo SUPERADMIN)' })
  async generateKeyPair() {
    return await this.signaturesService.generateKeyPair();
  }

  @Get('certificate')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Obtener información del certificado institucional' })
  async getCertificateInfo() {
    return await this.signaturesService.getCertificateInfo();
  }

  // =============================================
  // PAGINATED PROCESSES
  // =============================================

  @Get('processes/ready/paginated')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Listar procesos listos para firmar con paginación' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  async getProcessesReadyPaginated(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.signaturesService.getProcessesReadyForSigningPaginated({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
    });
  }

  // =============================================
  // AUDIT LOGS
  // =============================================

  @Get('audit-logs')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @ApiOperation({ summary: 'Obtener logs de auditoría de firmas' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  async getAuditLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
  ) {
    return this.signaturesService.getSignatureAuditLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      userId,
      action,
    });
  }

  // =============================================
  // ARCHIVE PROCESSES
  // =============================================

  @Post('processes/:processId/archive')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archivar un proceso completado (COMPLETED → ARCHIVED)' })
  @ApiParam({ name: 'processId', description: 'ID del proceso a archivar' })
  async archiveProcess(
    @Param('processId') processId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.signaturesService.archiveProcess(processId, user.sub, req.ip);
  }

  @Post('processes/archive-bulk')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Archivar masivamente procesos completados hace más de N días' })
  @ApiBody({ schema: { properties: { daysOld: { type: 'number', example: 30 } } } })
  async archiveCompletedProcesses(
    @Body('daysOld') daysOld: number,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.signaturesService.archiveCompletedProcesses(
      daysOld || 30,
      user.sub,
      req.ip,
    );
  }

  // =============================================
  // UNSIGN / REVERT SIGNATURE
  // =============================================

  @Post('processes/:processId/requirements/:requirementInstanceId/unsign')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revertir firma de un documento (FINALIZADO → APROBADO)',
    description: 'Elimina las firmas digitales y el PDF firmado, regresando el documento a estado APROBADO.',
  })
  @ApiParam({ name: 'processId', description: 'ID del proceso' })
  @ApiParam({ name: 'requirementInstanceId', description: 'ID del requisito a revertir' })
  async unsignRequirement(
    @Param('processId') processId: string,
    @Param('requirementInstanceId') requirementInstanceId: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    return this.signaturesService.unsignRequirement(
      processId,
      requirementInstanceId,
      user.sub,
      req.ip,
    );
  }
}
