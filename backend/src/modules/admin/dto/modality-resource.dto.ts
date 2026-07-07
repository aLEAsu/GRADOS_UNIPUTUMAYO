import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// DTO usado para crear un recurso asociado a una modalidad de grado.
// Recibe la información básica del archivo que será almacenado y mostrado
// dentro del módulo administrativo para las modalidades.
export class CreateModalityResourceDto {
  @ApiProperty({ description: 'Etiqueta que identifica el archivo', example: 'Acta de inicio de pasantía' })
  @IsString()
  label: string;

  @ApiPropertyOptional({ description: 'Descripción adicional del recurso', example: 'Formulario que el estudiante debe descargar y firmar' })
  @IsOptional()
  @IsString()
  description?: string;
}
