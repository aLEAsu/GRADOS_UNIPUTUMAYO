import { IsString, IsOptional, IsBoolean, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModalityDto {
  @ApiProperty({ description: 'Nombre de la modalidad', example: 'Trabajo de Grado (Tesis)' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Código único de la modalidad', example: 'THESIS' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Descripción de la modalidad', example: 'Modalidad de grado por investigación y desarrollo de tesis' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ description: 'Estado activo de la modalidad', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateModalityDto {
  @ApiPropertyOptional({ description: 'Nombre de la modalidad' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Descripción actualizada' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Estado activo de la modalidad' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class AddRequirementDto {
  @ApiProperty({ description: 'ID del tipo de documento requerido', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  documentTypeId: string;

  @ApiPropertyOptional({ description: 'Si el requisito es obligatorio', default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiProperty({ description: 'Orden de visualización', example: 1, minimum: 1 })
  @IsInt()
  @Min(1)
  displayOrder: number;

  @ApiPropertyOptional({ description: 'Instrucciones para el estudiante', example: 'Subir en formato PDF, máximo 20 páginas' })
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class RemoveRequirementDto {
  @ApiProperty({ description: 'ID del requisito a eliminar', example: '550e8400-e29b-41d4-a716-446655440000' })
  requirementId: string;
}
