/*admin.controller.ts */
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AdminService } from './admin.service';
import {
  CreateModalityDto,
  UpdateModalityDto,
  AddRequirementDto,
  UpdateRequirementDto,
} from './dto/modality.dto';
import {
  CreateDocumentTypeDto,
  UpdateDocumentTypeDto,
} from './dto/document-type.dto';
import { CreateModalityResourceDto } from './dto/modality-resource.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, UserRole } from '../../shared/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { FileValidationPipe } from '../documents/pipes/file-validation.pipe';

@ApiTags('Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminController {
  constructor(private adminService: AdminService) {}

  // Dashboard

  @Get('dashboard')
  @Roles(UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get dashboard statistics',
    description:
      'Retrieve dashboard statistics including student counts, process statuses, and recent activity.',
  })
  @ApiResponse({ status: 200, description: 'Dashboard statistics retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // Modalities

  @Get('modalities')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all degree modalities',
    description: 'Retrieve all degree modalities with their requirements.',
  })
  @ApiResponse({ status: 200, description: 'Modalities retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getModalities() {
    return this.adminService.getModalities();
  }

  @Post('modalities')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new degree modality',
    description: 'Create a new degree modality (e.g., Thesis, Internship).',
  })
  @ApiBody({ type: CreateModalityDto })
  @ApiResponse({ status: 201, description: 'Modality created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or modality already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createModality(@Body() dto: CreateModalityDto) {
    return this.adminService.createModality(dto);
  }

  @Patch('modalities/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a degree modality',
    description: 'Update modality details.',
  })
  @ApiBody({ type: UpdateModalityDto })
  @ApiResponse({ status: 200, description: 'Modality updated successfully' })
  @ApiResponse({ status: 404, description: 'Modality not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateModality(
    @Param('id') id: string,
    @Body() dto: UpdateModalityDto,
  ) {
    return this.adminService.updateModality(id, dto);
  }

  @Post('modalities/:id/requirements')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Add document type requirement to modality',
    description:
      'Add a document type as a requirement for a modality, optionally uploading a PDF or Word file for students.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentTypeId: { type: 'string' },
        documentTypeName: { type: 'string' },
        isRequired: { type: 'boolean' },
        displayOrder: { type: 'number', minimum: 1 },
        instructions: { type: 'string' },
        file: { type: 'string', format: 'binary', description: 'Optional PDF or Word file for this requirement' },
      },
      required: ['displayOrder'],
    },
  })
  @ApiResponse({ status: 201, description: 'Requirement added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or requirement already exists' })
  @ApiResponse({ status: 404, description: 'Modality or document type not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async addRequirementToModality(
    @Param('id') modalityId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: AddRequirementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.addRequirementToModality(modalityId, dto, user.sub, file);
  }

  @Patch('modalities/:id/requirements/:reqId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Update a modality requirement',
    description:
      'Update a document requirement for a modality, including optional file replacement, order, and instructions.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        documentTypeId: { type: 'string' },
        isRequired: { type: 'boolean' },
        displayOrder: { type: 'number', minimum: 1 },
        instructions: { type: 'string' },
        file: { type: 'string', format: 'binary', description: 'Optional replacement PDF or Word file for this requirement' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Requirement updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or requirement already exists' })
  @ApiResponse({ status: 404, description: 'Modality or requirement not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateRequirement(
    @Param('id') modalityId: string,
    @Param('reqId') requirementId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateRequirementDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.updateRequirement(modalityId, requirementId, dto, user.sub, file);
  }

  @Delete('modalities/:id/requirements/:reqId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove document type requirement from modality',
    description: 'Remove a document type requirement from a modality.',
  })
  @ApiResponse({ status: 200, description: 'Requirement removed successfully' })
  @ApiResponse({ status: 400, description: 'Requirement does not belong to this modality' })
  @ApiResponse({ status: 404, description: 'Requirement not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async removeRequirementFromModality(
    @Param('id') modalityId: string,
    @Param('reqId') requirementId: string,
  ) {
    return this.adminService.removeRequirementFromModality(modalityId, requirementId);
  }

  @Post('modalities/:id/resources')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(HttpStatus.CREATED)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a modality resource file',
    description:
      'Upload an optional PDF or Word file for a degree modality so students can download it.',
  })
  @ApiParam({ name: 'id', description: 'Modality ID', type: 'string' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file to upload',
        },
        label: {
          type: 'string',
          description: 'Label for the modality resource',
          example: 'Acta de inicio de pasantía',
        },
        description: {
          type: 'string',
          description: 'Optional description for the resource',
        },
      },
      required: ['file', 'label'],
    },
  })
  @ApiResponse({ status: 201, description: 'Modality resource uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file or input' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async uploadModalityResource(
    @Param('id') modalityId: string,
    @UploadedFile(FileValidationPipe) file: Express.Multer.File,
    @Body() dto: CreateModalityResourceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.adminService.uploadModalityResource(
      modalityId,
      dto,
      file,
      user.sub,
    );
  }

  @Get('modalities/:id/resources')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get modality resource list',
    description: 'Retrieve all optional resource files uploaded for a modality.',
  })
  @ApiParam({ name: 'id', description: 'Modality ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Modality resources retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getModalityResources(@Param('id') modalityId: string) {
    return this.adminService.getModalityResources(modalityId);
  }

  @Get('modalities/:id/resources/:resourceId/download')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.STUDENT, UserRole.ADVISOR, UserRole.SECRETARY)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Download a modality resource file',
    description: 'Download an optional file attached to a modality.',
  })
  @ApiParam({ name: 'id', description: 'Modality ID', type: 'string' })
  @ApiParam({ name: 'resourceId', description: 'Resource ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'File downloaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Resource not found' })
  async downloadModalityResource(
    @Param('id') modalityId: string,
    @Param('resourceId') resourceId: string,
    @Res() res: Response,
  ) {
    const file = await this.adminService.downloadModalityResource(resourceId, modalityId);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.buffer);
  }

  // Document Types

  @Get('document-types')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all document types',
    description: 'Retrieve all document types in the system.',
  })
  @ApiResponse({ status: 200, description: 'Document types retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getDocumentTypes() {
    return this.adminService.getDocumentTypes();
  }

  @Post('document-types')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new document type',
    description: 'Create a new document type for degree process requirements.',
  })
  @ApiBody({ type: CreateDocumentTypeDto })
  @ApiResponse({ status: 201, description: 'Document type created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or document type already exists' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createDocumentType(@Body() dto: CreateDocumentTypeDto) {
    return this.adminService.createDocumentType(dto);
  }

  @Patch('document-types/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a document type',
    description: 'Update document type details.',
  })
  @ApiBody({ type: UpdateDocumentTypeDto })
  @ApiResponse({ status: 200, description: 'Document type updated successfully' })
  @ApiResponse({ status: 404, description: 'Document type not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateDocumentType(
    @Param('id') id: string,
    @Body() dto: UpdateDocumentTypeDto,
  ) {
    return this.adminService.updateDocumentType(id, dto);
  }

  // Users

  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get users with filtering',
    description:
      'Retrieve users with optional filtering by role, active status, and search term.',
  })
  @ApiQuery({ name: 'role', required: false, enum: UserRole })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Users retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getUsers(@Query() filters: UserFilterDto) {
    return this.adminService.getUsers(filters);
  }

  @Patch('users/:id/role')
  @Roles(UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update user role',
    description: 'Change a user role. Superadmin only.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        role: { type: 'string', enum: Object.values(UserRole) },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'User role updated successfully' })
  @ApiResponse({ status: 400, description: 'Cannot downgrade superadmin user' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async updateUserRole(
    @Param('id') userId: string,
    @Body() body: { role: UserRole },
  ) {
    return this.adminService.updateUserRole(userId, body.role);
  }

  @Patch('users/:id/toggle-active')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Toggle user active status',
    description: 'Activate or deactivate a user account.',
  })
  @ApiResponse({ status: 200, description: 'User active status toggled successfully' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate a superadmin user' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async toggleUserActive(@Param('id') userId: string) {
    return this.adminService.toggleUserActive(userId);
  }

  // System Health

  @Public()
  @Get('health')
  @HttpCode(HttpStatus.OK)
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health/system')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get system health status',
    description: 'Check system health including database connectivity.',
  })
  @ApiResponse({ status: 200, description: 'System health retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }
}  
