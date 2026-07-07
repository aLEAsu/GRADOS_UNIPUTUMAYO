import { Type } from 'class-transformer';
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
  @ApiPropertyOptional({
    description: 'ID del tipo de documento requerido. Si no se proporciona, se puede crear un tipo nuevo con documentTypeName.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  documentTypeId?: string;

  @ApiPropertyOptional({
    description: 'Nombre de un nuevo tipo de documento a crear si no se selecciona uno existente.',
    example: 'Carta de presentación',
  })
  @IsOptional()
  @IsString()
  documentTypeName?: string;

  @ApiPropertyOptional({ description: 'Si el requisito es obligatorio', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isRequired?: boolean;

  @ApiProperty({ description: 'Orden de visualización', example: 1, minimum: 1 })
  @IsInt()
  @Type(() => Number)
  @Min(1)
  displayOrder: number;

  @ApiPropertyOptional({ description: 'Instrucciones para el estudiante', example: 'Subir en formato PDF, máximo 20 páginas' })
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class UpdateRequirementDto {
  @ApiPropertyOptional({
    description: 'ID del tipo de documento requerido. Si no se proporciona, se puede crear un tipo nuevo con documentTypeName.',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  documentTypeId?: string;

  @ApiPropertyOptional({
    description: 'Nombre de un nuevo tipo de documento a crear si no se selecciona uno existente.',
    example: 'Carta de presentación',
  })
  @IsOptional()
  @IsString()
  documentTypeName?: string;

  @ApiPropertyOptional({ description: 'Si el requisito es obligatorio', default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isRequired?: boolean;

  @ApiPropertyOptional({ description: 'Orden de visualización', example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Type(() => Number)
  @Min(1)
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Instrucciones para el estudiante', example: 'Subir en formato PDF, máximo 20 páginas' })
  @IsOptional()
  @IsString()
  instructions?: string;
}

export class RemoveRequirementDto {
  @ApiProperty({ description: 'ID del requisito a eliminar', example: '550e8400-e29b-41d4-a716-446655440000' })
  requirementId: string;
}
