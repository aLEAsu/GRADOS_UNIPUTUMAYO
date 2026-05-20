import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateObservationDto {
  @ApiProperty({
    description: 'Contenido de la observación (10-2000 caracteres)',
    example: 'El documento presenta errores en la sección de metodología que deben ser corregidos.',
    minLength: 10,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(10, { message: 'content must be at least 10 characters long' })
  @MaxLength(2000, { message: 'content must not exceed 2000 characters' })
  content: string;

  @ApiPropertyOptional({
    description: 'ID de la versión del documento asociada',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsUUID('4', { message: 'documentVersionId must be a valid UUID if provided' })
  documentVersionId?: string;
}
