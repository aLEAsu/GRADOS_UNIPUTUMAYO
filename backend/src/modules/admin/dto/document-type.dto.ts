import { IsString, IsOptional, IsArray, IsInt, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDocumentTypeDto {
  @ApiProperty({ description: 'Nombre del tipo de documento', example: 'Anteproyecto' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Código único del tipo', example: 'ANTEPROYECTO' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Descripción del tipo de documento', example: 'Documento de anteproyecto de grado' })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Tipos MIME aceptados',
    example: ['application/pdf', 'application/msword'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  acceptedMimeTypes: string[];

  @ApiPropertyOptional({ description: 'Tamaño máximo en MB (1-100)', example: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxFileSizeMb?: number;

  @ApiPropertyOptional({ description: 'URL de plantilla de referencia', example: 'https://itp.edu.co/templates/anteproyecto.docx' })
  @IsOptional()
  @IsString()
  templateUrl?: string;
}

export class UpdateDocumentTypeDto {
  @ApiPropertyOptional({ description: 'Nombre del tipo de documento', example: 'Anteproyecto actualizado' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Descripción actualizada' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Tipos MIME aceptados', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedMimeTypes?: string[];

  @ApiPropertyOptional({ description: 'Tamaño máximo en MB', minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxFileSizeMb?: number;

  @ApiPropertyOptional({ description: 'URL de plantilla de referencia' })
  @IsOptional()
  @IsString()
  templateUrl?: string;
}
