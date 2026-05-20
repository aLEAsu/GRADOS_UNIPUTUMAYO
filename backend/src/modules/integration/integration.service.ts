import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import {
  ExternalStudentData,
  InternalStudentData,
  StudentEligibilityResult,
} from './dto/external-student.dto';
import { IntegrationException } from './exceptions/integration.exception';
import { firstValueFrom, retry, timer, catchError, throwError } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);
  private readonly apiKey: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.apiKey = this.configService.get<string>('ITP_API_KEY', '');
    this.maxRetries = this.configService.get<number>('ITP_API_MAX_RETRIES', 2);
    this.retryDelayMs = this.configService.get<number>('ITP_API_RETRY_DELAY', 1000);
  }

  /**
   * Fetch student data from external API using HttpService with RxJS retry
   */
  async fetchStudentData(studentCode: string): Promise<ExternalStudentData> {
    const url = `/students/${studentCode}`;

    const response$ = this.httpService.get<ExternalStudentData>(url, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
    }).pipe(
      retry({
        count: this.maxRetries,
        delay: (error: AxiosError, retryCount: number) => {
          this.logger.warn(
            `Request to ${url} failed (attempt ${retryCount}/${this.maxRetries}): ${error.message}. Retrying in ${this.retryDelayMs}ms...`,
          );
          return timer(this.retryDelayMs);
        },
      }),
      catchError((error: AxiosError) => {
        const status = error.response?.status;
        const statusText = error.response?.statusText || error.message;

        this.logger.error(
          `External API call failed after ${this.maxRetries + 1} attempts: [${status}] ${statusText}`,
        );

        return throwError(() =>
          new IntegrationException(
            `External API returned status ${status || 'UNKNOWN'}: ${statusText}`,
          ),
        );
      }),
    );

    const response = await firstValueFrom(response$);
    return response.data;
  }

  /**
   * Sync student profile with external data
   */
  async syncStudentProfile(userId: string): Promise<InternalStudentData> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user) {
      throw new IntegrationException('User not found');
    }

    if (!user.studentProfile) {
      throw new IntegrationException('Student profile not found');
    }

    const externalData = await this.fetchStudentData(user.studentProfile.studentCode);
    const internalData = this.mapExternalToInternal(externalData);

    await this.prisma.studentProfile.update({
      where: { userId },
      data: {
        program: internalData.program,
        faculty: internalData.faculty,
        semester: internalData.semester,
        academicStatus: internalData.academicStatus,
        hasCompletedSubjects: internalData.hasCompletedSubjects,
        externalStudentId: internalData.externalStudentId,
        lastSyncAt: internalData.lastSyncAt,
      },
    });

    this.logger.log(`Student profile synced for userId=${userId}, code=${user.studentProfile.studentCode}`);
    return internalData;
  }

  /**
   * Validate student eligibility based on completed subjects
   */
  async validateStudentEligibility(studentCode: string): Promise<StudentEligibilityResult> {
    try {
      const externalData = await this.fetchStudentData(studentCode);
      const hasCompletedAllSubjects = externalData.hasCompletedAllSubjects ?? false;

      if (hasCompletedAllSubjects) {
        return { eligible: true };
      }

      return {
        eligible: false,
        reason: `Student has not completed all required subjects (${externalData.completedSubjects ?? 0}/${externalData.totalSubjects ?? 0})`,
      };
    } catch (error) {
      throw new IntegrationException(
        `Failed to validate student eligibility: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Anti-Corruption Layer: Map external API fields to internal model
   * Handles missing/null fields gracefully
   */
  private mapExternalToInternal(externalData: ExternalStudentData): InternalStudentData {
    const academicStatusMap: Record<string, 'ACTIVE' | 'INACTIVE' | 'GRADUATED' | 'SUSPENDED'> = {
      ACTIVE: 'ACTIVE',
      INACTIVE: 'INACTIVE',
      GRADUATED: 'GRADUATED',
      SUSPENDED: 'SUSPENDED',
      active: 'ACTIVE',
      inactive: 'INACTIVE',
      graduated: 'GRADUATED',
      suspended: 'SUSPENDED',
    };

    const mappedStatus = academicStatusMap[externalData.academicStatus] || 'ACTIVE';

    return {
      studentCode: externalData.code || externalData.id,
      program: externalData.program || 'UNKNOWN',
      faculty: externalData.faculty || 'UNKNOWN',
      semester: externalData.semester ?? 1,
      academicStatus: mappedStatus,
      hasCompletedSubjects: externalData.hasCompletedAllSubjects ?? false,
      externalStudentId: externalData.id,
      lastSyncAt: new Date(externalData.lastUpdated || new Date()),
    };
  }
}
