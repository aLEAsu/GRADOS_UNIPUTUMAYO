import { Controller, Post, Headers, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from './shared/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('seed')
export class SeedController {
  constructor(private prisma: PrismaService) {}

  @Post('run')
  async runSeed(@Headers('x-seed-token') token: string) {
    if (token !== 'itp-seed-2024-secret') {
      throw new UnauthorizedException('Invalid seed token');
    }

    const { UserRole, AcademicStatus } = await import('@prisma/client');

    // Usuarios
    const superAdminHash = await bcrypt.hash('Admin@2024', 10);
    await this.prisma.user.upsert({
      where: { email: 'admin@itp.edu.co' },
      update: {},
      create: {
        email: 'admin@itp.edu.co',
        passwordHash: superAdminHash,
        firstName: 'Admin',
        lastName: 'Sistema',
        role: UserRole.SUPERADMIN,
        isActive: true,
        emailVerified: true,
        institutionalEmail: 'admin@itp.edu.co',
      },
    });

    const secretaryHash = await bcrypt.hash('Secretary@2024', 10);
    await this.prisma.user.upsert({
      where: { email: 'secretaria@itp.edu.co' },
      update: {},
      create: {
        email: 'secretaria@itp.edu.co',
        passwordHash: secretaryHash,
        firstName: 'Secretaría',
        lastName: 'Grados',
        role: UserRole.SECRETARY,
        isActive: true,
        emailVerified: true,
        institutionalEmail: 'secretaria@itp.edu.co',
      },
    });

    const studentHash = await bcrypt.hash('Student@2024', 10);
    const studentUser = await this.prisma.user.upsert({
      where: { email: 'estudiante@itp.edu.co' },
      update: {},
      create: {
        email: 'estudiante@itp.edu.co',
        passwordHash: studentHash,
        firstName: 'Carlos',
        lastName: 'Pérez',
        role: UserRole.STUDENT,
        isActive: true,
        emailVerified: true,
        institutionalEmail: 'estudiante@itp.edu.co',
      },
    });

    await this.prisma.studentProfile.upsert({
      where: { userId: studentUser.id },
      update: {},
      create: {
        userId: studentUser.id,
        studentCode: '2020150001',
        program: 'Ingeniería de Sistemas',
        faculty: 'Ingeniería',
        semester: 10,
        academicStatus: AcademicStatus.ACTIVE,
        hasCompletedSubjects: true,
      },
    });

    const advisorHash = await bcrypt.hash('Advisor@2024', 10);
    const advisorUser = await this.prisma.user.upsert({
      where: { email: 'asesor@itp.edu.co' },
      update: {},
      create: {
        email: 'asesor@itp.edu.co',
        passwordHash: advisorHash,
        firstName: 'Dr. Juan',
        lastName: 'García',
        role: UserRole.ADVISOR,
        isActive: true,
        emailVerified: true,
        institutionalEmail: 'asesor@itp.edu.co',
      },
    });

    await this.prisma.advisorProfile.upsert({
      where: { userId: advisorUser.id },
      update: {},
      create: {
        userId: advisorUser.id,
        department: 'Ingeniería',
        specialization: 'Asesoría de grado',
        maxActiveProcesses: 5,
        currentActiveProcesses: 0,
        isAvailable: true,
      },
    });

    return {
      message: 'Seed ejecutado correctamente',
      users: [
        'admin@itp.edu.co / Admin@2024 (SUPERADMIN)',
        'secretaria@itp.edu.co / Secretary@2024 (SECRETARY)',
        'estudiante@itp.edu.co / Student@2024 (STUDENT)',
        'asesor@itp.edu.co / Advisor@2024 (ADVISOR)',
      ],
    };
  }
}
