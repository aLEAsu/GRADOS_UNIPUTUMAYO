import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/guards/roles.guard';
import { Roles, UserRole } from '../../shared/decorators/roles.decorator';
import { CurrentUser, JwtPayload } from '../../shared/decorators/current-user.decorator';
import { CreateApprovalDto } from './dto/create-approval.dto';
import { CreateObservationDto } from './dto/create-observation.dto';

@ApiTags('Reviews')
@ApiBearerAuth()
@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private reviewsService: ReviewsService) {}

  /**
   * Send a requirement to review
   * POST /reviews/requirement/:id/send-to-review
   */
  @Post('requirement/:id/send-to-review')
  @Roles(UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN)
  async sendToReview(
    @Param('id') requirementInstanceId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviewsService.sendToReview(requirementInstanceId);
  }

  /**
   * Create academic approval (by advisor)
   * POST /reviews/requirement/:id/academic-approval
   */
  @Post('requirement/:id/academic-approval')
  @Roles(UserRole.ADVISOR)
  async createAcademicApproval(
    @Param('id') requirementInstanceId: string,
    @Body() dto: CreateApprovalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviewsService.createAcademicApproval(
      requirementInstanceId,
      user.sub,
      dto,
    );
  }

  /**
   * Create administrative approval (by secretary)
   * POST /reviews/requirement/:id/administrative-approval
   */
  @Post('requirement/:id/administrative-approval')
  @Roles(UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN)
  async createAdministrativeApproval(
    @Param('id') requirementInstanceId: string,
    @Body() dto: CreateApprovalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviewsService.createAdministrativeApproval(
      requirementInstanceId,
      user.sub,
      dto,
    );
  }

  /**
   * Get all approvals for a requirement
   * GET /reviews/requirement/:id/approvals
   */
  @Get('requirement/:id/approvals')
  async getApprovalsByRequirement(
    @Param('id') requirementInstanceId: string,
  ) {
    return this.reviewsService.getApprovalsByRequirement(requirementInstanceId);
  }

  /**
   * Get all approvals for a process
   * GET /reviews/process/:id/approvals
   */
  @Get('process/:id/approvals')
  async getApprovalsByProcess(@Param('id') processId: string) {
    return this.reviewsService.getApprovalsByProcess(processId);
  }

  /**
   * Add observation for a requirement
   * POST /reviews/requirement/:id/observations
   */
  @Post('requirement/:id/observations')
  async addObservation(
    @Param('id') requirementInstanceId: string,
    @Body() dto: CreateObservationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviewsService.addObservation(
      requirementInstanceId,
      user.sub,
      dto,
    );
  }

  /**
   * Resolve an observation
   * PATCH /reviews/observations/:id/resolve
   */
  @Patch('observations/:id/resolve')
  async resolveObservation(
    @Param('id') observationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.reviewsService.resolveObservation(observationId);
  }

  /**
   * Get pending academic reviews for current advisor
   * GET /reviews/pending/academic
   */
  @Get('pending/academic')
  @Roles(UserRole.ADVISOR)
  async getPendingReviews(@CurrentUser() user: JwtPayload) {
    return this.reviewsService.getPendingReviews(user.sub);
  }

  /**
   * Get pending administrative reviews (requirements ready for secretary approval)
   * GET /reviews/pending/administrative
   */
  @Get('pending/administrative')
  @Roles(UserRole.SECRETARY, UserRole.ADMIN, UserRole.SUPERADMIN)
  async getPendingAdminReviews() {
    return this.reviewsService.getPendingAdminReviews();
  }
}
