import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { AcademicStatus } from '@prisma/client';
import {
  UpdateProfileDto,
  CreateStudentProfileDto,
  CreateAdvisorProfileDto,
} from './dto/profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get user by ID with profile
   */
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
        studentProfile: true,
        advisorProfile: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Update user profile info
   */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Create student profile
   */
  async createStudentProfile(userId: string, dto: CreateStudentProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingProfile = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new BadRequestException('Student profile already exists for this user');
    }

    const existingStudentCode = await this.prisma.studentProfile.findUnique({
      where: { studentCode: dto.studentCode },
    });

    if (existingStudentCode) {
      throw new BadRequestException('This student code is already registered');
    }

    return this.prisma.studentProfile.create({
      data: {
        userId,
        studentCode: dto.studentCode,
        program: dto.program,
        faculty: dto.faculty,
        semester: dto.semester,
        academicStatus: dto.academicStatus ?? AcademicStatus.ACTIVE,
      },
    });
  }

  /**
   * Create advisor profile
   */
  async createAdvisorProfile(userId: string, dto: CreateAdvisorProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const existingProfile = await this.prisma.advisorProfile.findUnique({
      where: { userId },
    });

    if (existingProfile) {
      throw new BadRequestException('Advisor profile already exists for this user');
    }

    return this.prisma.advisorProfile.create({
      data: {
        userId,
        department: dto.department,
        specialization: dto.specialization,
        maxActiveProcesses: dto.maxActiveProcesses ?? 5,
      },
    });
  }

  /**
   * Get student profile with process history
   */
  async getStudentProfile(userId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Student profile not found');
    }

    // Get process history
    const processes = await this.prisma.degreeProcess.findMany({
      where: { studentId: userId },
      include: {
        modality: true,
        advisor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...profile,
      processes,
    };
  }

  /**
   * Get advisor profile with assigned processes
   */
  async getAdvisorProfile(userId: string) {
    const profile = await this.prisma.advisorProfile.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException('Advisor profile not found');
    }

    // Get assigned processes
    const processes = await this.prisma.degreeProcess.findMany({
      where: { advisorId: userId },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        modality: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      ...profile,
      processes,
    };
  }

  /**
   * Get available advisors (with capacity)
   */
  async getAvailableAdvisors() {
    const advisors = await this.prisma.advisorProfile.findMany({
      where: {
        isAvailable: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
      },
      orderBy: { currentActiveProcesses: 'asc' },
    });

    return advisors.filter(
      (advisor) =>
        advisor.currentActiveProcesses < advisor.maxActiveProcesses,
    );
  }
}
