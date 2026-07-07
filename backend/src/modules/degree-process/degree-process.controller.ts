import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { DegreeProcessService } from './degree-process.service';
import { CreateProcessDto } from './dto/create-process.dto';
import { AssignAdvisorDto } from './dto/assign-advisor.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { ProcessFilterDto } from './dto/process-filter.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, UserRole } from '../../shared/decorators/roles.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../shared/decorators/current-user.decorator';

/**
 * Controller for degree process endpoints
 * Manages student inscriptions to degree modalities
 */
@ApiTags('Degree Processes')
@Controller('degree-processes')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('bearer')
export class DegreeProcessController {
  constructor(private degreeProcessService: DegreeProcessService) {}

  /**
   * Create a new degree process
   */
  @Post()
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new degree process',
    description: 'Student submits inscription to a degree modality. Process starts in DRAFT status.',
  })
  @ApiBody({ type: CreateProcessDto })
  @ApiResponse({ status: 201, description: 'Degree process created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or business rule violation' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Student or modality not found' })
  async createProcess(
    @Body() createProcessDto: CreateProcessDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.degreeProcessService.createProcess(user.sub, createProcessDto);
  }

  /**
   * Get all degree processes with filtering and pagination (admin/secretary only)
   */
  @Get()
  @Roles(UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get all degree processes',
    description: 'Retrieve all degree processes with filtering and pagination. Secretary/Admin only.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ['DRAFT', 'ACTIVE', 'IN_REVIEW', 'APPROVED', 'COMPLETED', 'ARCHIVED'] })
  @ApiQuery({ name: 'modalityCode', required: false })
  @ApiQuery({ name: 'studentId', required: false })
  @ApiQuery({ name: 'advisorId', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Degree processes retrieved successfully' })
  async getAllProcesses(@Query() filters: ProcessFilterDto) {
    return this.degreeProcessService.getAllProcesses(filters);
  }

  /**
   * Get my processes (students see their own, advisors see assigned ones)
   */
  @Get('my-processes')
  @Roles(UserRole.STUDENT, UserRole.ADVISOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get my processes',
    description: 'Students retrieve their own processes, advisors retrieve assigned ones.',
  })
  @ApiResponse({ status: 200, description: 'Processes retrieved successfully' })
  async getMyProcesses(@CurrentUser() user: JwtPayload) {
    if (user.role === UserRole.STUDENT) {
      return this.degreeProcessService.getProcessesByStudent(user.sub);
    } else {
      return this.degreeProcessService.getProcessesByAdvisor(user.sub);
    }
  }

  /**
   * Get all available modalities
   */
  @Get('modalities')
  @Roles(UserRole.STUDENT, UserRole.ADVISOR, UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available degree modalities',
    description: 'Retrieve all active degree modalities. Accessible to all authenticated users.',
  })
  @ApiResponse({ status: 200, description: 'Modalities retrieved successfully' })
  async getModalities() {
    return this.degreeProcessService.getModalities();
  }

  /**
   * Get a specific degree process by ID (permission-based)
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get degree process by ID',
    description: 'Retrieve a specific degree process. Access controlled by role and process ownership.',
  })
  @ApiParam({ name: 'id', description: 'Process UUID', type: String })
  @ApiResponse({ status: 200, description: 'Degree process retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  async getProcessById(
    @Param('id', ParseUUIDPipe) processId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.degreeProcessService.getProcessById(processId, user.sub, user.role);
  }

  /**
   * Get process summary with completion metrics (permission-based)
   */
  @Get(':id/summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get process summary',
    description: 'Retrieve summary of degree process with completion percentages. Access controlled by ownership/role.',
  })
  @ApiParam({ name: 'id', description: 'Process UUID', type: String })
  @ApiResponse({ status: 200, description: 'Process summary retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden — not authorized to view this process' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  async getProcessSummary(
    @Param('id', ParseUUIDPipe) processId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.degreeProcessService.getProcessSummary(processId, user.sub, user.role);
  }

  /**
   * Assign an advisor to a degree process (secretary/admin only)
   */
  @Patch(':id/assign-advisor')
  @Roles(UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Assign advisor to process',
    description: 'Secretary/Admin assigns an advisor to a degree process.',
  })
  @ApiParam({ name: 'id', description: 'Process UUID', type: String })
  @ApiBody({ type: AssignAdvisorDto })
  @ApiResponse({ status: 200, description: 'Advisor assigned successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or business rule violation' })
  @ApiResponse({ status: 404, description: 'Process or advisor not found' })
  async assignAdvisor(
    @Param('id', ParseUUIDPipe) processId: string,
    @Body() assignAdvisorDto: AssignAdvisorDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.degreeProcessService.assignAdvisor(processId, assignAdvisorDto, user.sub);
  }

  /**
   * Activate a degree process (DRAFT → ACTIVE)
   */
  @Patch(':id/activate')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Activate degree process',
    description: 'Student submits inscription. Transitions process from DRAFT to ACTIVE.',
  })
  @ApiParam({ name: 'id', description: 'Process UUID', type: String })
  @ApiResponse({ status: 200, description: 'Process activated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid state transition or missing advisor' })
  async activateProcess(
    @Param('id', ParseUUIDPipe) processId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.degreeProcessService.activateProcess(processId, user.sub);
  }

  /**
   * Update process status (role-dependent state transitions)
   */
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update process status',
    description: 'Update the status of a degree process. State transitions validated by role.',
  })
  @ApiParam({ name: 'id', description: 'Process UUID', type: String })
  @ApiBody({ type: UpdateStatusDto })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid state transition' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  async updateProcessStatus(
    @Param('id', ParseUUIDPipe) processId: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.degreeProcessService.updateProcessStatus(processId, updateStatusDto, user.sub, user.role);
  }

  /**
   * Finalize a degree process by setting its status to COMPLETED
   */
  @Patch(':id/finalize')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finalize degree process',
    description: 'Administrator finalizes a degree process by marking it as COMPLETED.',
  })
  @ApiParam({ name: 'id', description: 'Process UUID', type: String })
  @ApiResponse({ status: 200, description: 'Process finalized successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  async finalizeProcess(
    @Param('id', ParseUUIDPipe) processId: string,
  ) {
    return this.degreeProcessService.adminFinalizeProcess(processId);
  }

  /**
   * Delete a degree process permanently
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete degree process',
    description: 'Administrator permanently deletes a degree process and its related data.',
  })
  @ApiParam({ name: 'id', description: 'Process UUID', type: String })
  @ApiResponse({ status: 200, description: 'Process deleted successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Process not found' })
  async deleteProcess(@Param('id', ParseUUIDPipe) processId: string) {
    return this.degreeProcessService.adminDeleteProcess(processId);
  }
}
