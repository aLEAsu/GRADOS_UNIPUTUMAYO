import {
  IsEmail,
  IsString,
  MinLength,
  Matches,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'Email institucional del estudiante', example: 'estudiante@itp.edu.co' })
  @IsEmail()
  email: string;

  @ApiProperty({
    description: 'Contraseña (mín. 8 caracteres, 1 mayúscula, 1 minúscula, 1 número)',
    example: 'MiPassword123',
    minLength: 8,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{8,}$/,
    { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' },
  )
  password: string;

  @ApiProperty({ description: 'Nombre del estudiante', example: 'Juan', minLength: 2 })
  @IsString()
  @MinLength(2, { message: 'First name must be at least 2 characters long' })
  firstName: string;

  @ApiProperty({ description: 'Apellido del estudiante', example: 'Pérez', minLength: 2 })
  @IsString()
  @MinLength(2, { message: 'Last name must be at least 2 characters long' })
  lastName: string;

  @ApiPropertyOptional({ description: 'Teléfono de contacto', example: '+573001234567' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ description: 'Código estudiantil', example: 'EST-2024001', minLength: 3 })
  @IsString()
  @MinLength(3, { message: 'Student code must be at least 3 characters long' })
  studentCode: string;

  @ApiProperty({ description: 'Programa académico', example: 'Ingeniería de Sistemas', minLength: 3 })
  @IsString()
  @MinLength(3, { message: 'Program must be at least 3 characters long' })
  program: string;

  @ApiPropertyOptional({ description: 'Facultad', example: 'Facultad de Ingeniería' })
  @IsOptional()
  @IsString()
  faculty?: string;

  @ApiPropertyOptional({ description: 'Semestre actual (1-12)', example: 10, minimum: 1, maximum: 12 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  semester?: number;

  @ApiProperty({ description: 'Acepta la política de uso de datos', example: true })
  @IsBoolean()
  acceptPolicy: boolean;
}
