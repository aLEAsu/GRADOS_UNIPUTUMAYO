import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
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
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import {
  UpdateProfileDto,
  CreateStudentProfileDto,
  CreateAdvisorProfileDto,
} from './dto/profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, UserRole } from '../../shared/decorators/roles.decorator';
import {
  CurrentUser,
  JwtPayload,
} from '../../shared/decorators/current-user.decorator';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService, private notificationsService: NotificationsService) {}

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current authenticated user',
    description: 'Retrieve the profile of the authenticated user',
  })
  @ApiResponse({
    status: 200,
    description: 'Current user retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getCurrentUser(@CurrentUser() user: JwtPayload) {
    return this.usersService.getUserById(user.sub);
  }

  @Patch('me')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update current user profile',
    description: 'Update profile information for the authenticated user',
  })
  @ApiBody({ type: UpdateProfileDto })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateMyProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(user.sub, dto);

    // After updating profile, verify completeness and mark onboarding notifications as read if complete
    try {
      const full = await this.usersService.getUserById(user.sub);
      const missing: string[] = [];
      if (!full.phone) missing.push('Teléfono');
      if (!full.firstName) missing.push('Nombre');
      if (!full.lastName) missing.push('Apellidos');
      if (full.role === 'STUDENT') {
        if (!full.studentProfile?.studentCode) missing.push('Código estudiante');
        if (!full.studentProfile?.program) missing.push('Programa');
      }

      if (missing.length === 0) {
        await this.notificationsService.markNotificationsByTitle(user.sub, 'Completa tu perfil');
      }
    } catch (err) {
      // don't block the update if notification marking fails
    }

    return updated;
  }

  @Get('advisors/available')
  @Roles(UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get available advisors',
    description:
      'Get list of advisors available for process assignment (not at capacity). Secretary/Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Available advisors retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getAvailableAdvisors() {
    return this.usersService.getAvailableAdvisors();
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SECRETARY, UserRole.SUPERADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieve user information by ID. Admin/Secretary only.',
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUserById(@Param('id') userId: string) {
    return this.usersService.getUserById(userId);
  }

  @Post('me/student-profile')
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create student profile',
    description: 'Create a student profile for the authenticated user. Student only.',
  })
  @ApiBody({ type: CreateStudentProfileDto })
  @ApiResponse({
    status: 201,
    description: 'Student profile created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Student code already exists or profile already created',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async createStudentProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateStudentProfileDto,
  ) {
    const profile = await this.usersService.createStudentProfile(user.sub, dto);

    // After creating student profile, check if there are onboarding notifications and mark them read
    try {
      const full = await this.usersService.getUserById(user.sub);
      const missing: string[] = [];
      if (!full.phone) missing.push('Teléfono');
      if (!full.firstName) missing.push('Nombre');
      if (!full.lastName) missing.push('Apellidos');
      if (full.role === 'STUDENT') {
        if (!full.studentProfile?.studentCode) missing.push('Código estudiante');
        if (!full.studentProfile?.program) missing.push('Programa');
      }

      if (missing.length === 0) {
        await this.notificationsService.markNotificationsByTitle(user.sub, 'Completa tu perfil');
      }
    } catch (err) {
      // ignore
    }

    return profile;
  }

  @Post('me/advisor-profile')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create advisor profile',
    description: 'Create an advisor profile for a user. Admin only.',
  })
  @ApiBody({ type: CreateAdvisorProfileDto })
  @ApiResponse({
    status: 201,
    description: 'Advisor profile created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Advisor profile already exists for this user',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async createAdvisorProfile(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateAdvisorProfileDto,
  ) {
    return this.usersService.createAdvisorProfile(user.sub, dto);
  }
}
