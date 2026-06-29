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
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { AdminService } from './admin.service';
import {
  CreateModalityDto,
  UpdateModalityDto,
  AddRequirementDto,
} from './dto/modality.dto';
import {
  CreateDocumentTypeDto,
  UpdateDocumentTypeDto,
} from './dto/document-type.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, UserRole } from '../../shared/decorators/roles.decorator';
import { Public } from '../../shared/decorators/public.decorator';

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
  @ApiResponse({
    status: 200,
    description: 'Dashboard statistics retrieved successfully',
  })
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
  @ApiResponse({
    status: 200,
    description: 'Modalities retrieved successfully',
  })
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
  @ApiResponse({
    status: 201,
    description: 'Modality created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or modality already exists',
  })
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
  @ApiResponse({
    status: 200,
    description: 'Modality updated successfully',
  })
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
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add document type requirement to modality',
    description: 'Add a document type as a requirement for a modality.',
  })
  @ApiBody({ type: AddRequirementDto })
  @ApiResponse({
    status: 201,
    description: 'Requirement added successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or requirement already exists',
  })
  @ApiResponse({ status: 404, description: 'Modality or document type not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async addRequirementToModality(
    @Param('id') modalityId: string,
    @Body() dto: AddRequirementDto,
  ) {
    return this.adminService.addRequirementToModality(modalityId, dto);
  }

  @Delete('modalities/:id/requirements/:reqId')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove document type requirement from modality',
    description: 'Remove a document type requirement from a modality.',
  })
  @ApiResponse({
    status: 200,
    description: 'Requirement removed successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Requirement does not belong to this modality',
  })
  @ApiResponse({ status: 404, description: 'Requirement not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async removeRequirementFromModality(
    @Param('id') modalityId: string,
    @Param('reqId') requirementId: string,
  ) {
    return this.adminService.removeRequirementFromModality(modalityId, requirementId);
  }

  // Document Types

  @Get('document-types')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all document types',
    description: 'Retrieve all document types in the system.',
  })
  @ApiResponse({
    status: 200,
    description: 'Document types retrieved successfully',
  })
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
  @ApiResponse({
    status: 201,
    description: 'Document type created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input or document type already exists',
  })
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
  @ApiResponse({
    status: 200,
    description: 'Document type updated successfully',
  })
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
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
  })
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
        role: {
          type: 'string',
          enum: Object.values(UserRole),
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'User role updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot downgrade superadmin user',
  })
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
  @ApiResponse({
    status: 200,
    description: 'User active status toggled successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Cannot deactivate a superadmin user',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async toggleUserActive(@Param('id') userId: string) {
    return this.adminService.toggleUserActive(userId);
  }

  // System Health

  @Public()
  @Get('health')
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get system health status',
    description: 'Check system health including database connectivity.',
  })
  @ApiResponse({
    status: 200,
    description: 'System health retrieved successfully',
    schema: {
      example: {
        status: 'healthy',
        database: 'connected',
        timestamp: '2026-03-18T10:30:00Z',
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }
}
