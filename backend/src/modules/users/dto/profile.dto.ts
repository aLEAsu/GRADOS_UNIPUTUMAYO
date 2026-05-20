import {
  IsString,
  IsOptional,
  IsPhoneNumber,
  IsInt,
  Min,
  IsEnum,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AcademicStatus } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional({ description: 'Nombre', example: 'Juan' })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Apellido', example: 'Pérez' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto', example: '+573001234567' })
  @IsOptional()
  @IsPhoneNumber()
  phone?: string;

  @ApiPropertyOptional({ description: 'URL del avatar', example: 'https://example.com/avatar.jpg' })
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

export class CreateStudentProfileDto {
  @ApiProperty({ description: 'Código estudiantil', example: 'EST-2024001' })
  @IsString()
  studentCode: string;

  @ApiProperty({ description: 'Programa académico', example: 'Ingeniería de Sistemas' })
  @IsString()
  program: string;

  @ApiProperty({ description: 'Facultad', example: 'Facultad de Ingeniería' })
  @IsString()
  faculty: string;

  @ApiProperty({ description: 'Semestre actual', example: 10, minimum: 1 })
  @IsInt()
  @Min(1)
  semester: number;

  @ApiPropertyOptional({ description: 'Estado académico', enum: AcademicStatus, default: 'ACTIVE' })
  @IsOptional()
  @IsEnum(AcademicStatus)
  academicStatus?: AcademicStatus;
}

export class CreateAdvisorProfileDto {
  @ApiProperty({ description: 'Departamento del asesor', example: 'Ingeniería de Software' })
  @IsString()
  department: string;

  @ApiProperty({ description: 'Especialización', example: 'Inteligencia Artificial' })
  @IsString()
  specialization: string;

  @ApiPropertyOptional({ description: 'Máximo de procesos activos simultáneos', example: 5, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxActiveProcesses?: number;
}
