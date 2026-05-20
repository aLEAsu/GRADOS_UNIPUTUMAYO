import { IsUUID, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new degree process
 */
export class CreateProcessDto {
  @ApiProperty({
    description: 'ID de la modalidad de grado a inscribir',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  modalityId: string;

  @ApiPropertyOptional({
    description: 'Título del proyecto o trabajo de grado',
    example: 'Sistema de gestión académica basado en microservicios',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Descripción del proyecto o trabajo de grado',
    example: 'Desarrollo de un sistema distribuido para la gestión de procesos académicos',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
