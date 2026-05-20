import {
  Controller,
  Post,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { IntegrationService } from './integration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, UserRole } from '../../shared/decorators/roles.decorator';

@ApiTags('Integration')
@Controller('integration')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  @Post('sync-student/:userId')
  @Roles(UserRole.SECRETARY, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sync student profile with external API',
    description:
      'Fetch and update student profile data from the university external API. Secretary/Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Student profile synced successfully',
    schema: {
      example: {
        studentCode: 'STU123456',
        program: 'Computer Science',
        faculty: 'Engineering',
        semester: 8,
        academicStatus: 'ACTIVE',
        hasCompletedSubjects: true,
        externalStudentId: 'EXT123456',
        lastSyncAt: '2026-03-18T10:30:00Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Integration error or invalid input',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'User or student profile not found' })
  async syncStudentProfile(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.integrationService.syncStudentProfile(userId);
  }

  @Get('student-eligibility/:studentCode')
  @Roles(UserRole.SECRETARY, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check student eligibility',
    description:
      'Validate if a student has completed all required subjects for degree process. Secretary/Admin only.',
  })
  @ApiResponse({
    status: 200,
    description: 'Student eligibility checked successfully',
    schema: {
      example: {
        eligible: true,
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Student eligibility checked with reason',
    schema: {
      example: {
        eligible: false,
        reason: 'Student has not completed all required subjects (40/48)',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Integration error',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async validateStudentEligibility(@Param('studentCode') studentCode: string) {
    return this.integrationService.validateStudentEligibility(studentCode);
  }
}
