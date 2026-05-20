import { IsUUID, IsString, IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignDocumentDto {
  @ApiProperty({
    description: 'The ID of the requirement instance to sign',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  requirementInstanceId: string;

  @ApiProperty({
    description: 'The ID of the document version to sign',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  documentVersionId: string;
}

export class SignProcessDto {
  @ApiProperty({
    description: 'The ID of the degree process to sign all documents',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  processId: string;
}

export class CreateSignatureImageDto {
  @ApiProperty({ description: 'ID del usuario al que pertenece la firma' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'Etiqueta descriptiva', example: 'Director CIECYT' })
  @IsString()
  label: string;
}

export class UpdateSignatureImageDto {
  @ApiPropertyOptional({ description: 'Etiqueta descriptiva' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Si la firma está activa' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateSignatureConfigDto {
  @ApiProperty({ description: 'ID del tipo de documento' })
  @IsUUID()
  documentTypeId: string;

  @ApiProperty({ description: 'Rol del firmante', example: 'ADVISOR' })
  @IsString()
  signerRole: string;

  @ApiPropertyOptional({ description: 'ID de la imagen de firma asignada' })
  @IsOptional()
  @IsUUID()
  signatureImageId?: string;

  @ApiProperty({ description: 'Posición X en el PDF (pts)', example: 100 })
  @IsNumber()
  @Min(0)
  positionX: number;

  @ApiProperty({ description: 'Posición Y en el PDF (pts)', example: 680 })
  @IsNumber()
  @Min(0)
  positionY: number;

  @ApiPropertyOptional({ description: 'Ancho de la firma en pts', example: 150 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  width?: number;

  @ApiPropertyOptional({ description: 'Alto de la firma en pts', example: 60 })
  @IsOptional()
  @IsNumber()
  @Min(10)
  height?: number;

  @ApiPropertyOptional({ description: 'Orden de visualización', example: 1 })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @ApiProperty({ description: 'Etiqueta', example: 'Asesor de proyecto' })
  @IsString()
  label: string;
}

export class UpdateSignatureConfigDto {
  @ApiPropertyOptional({ description: 'ID de la imagen de firma asignada' })
  @IsOptional()
  @IsUUID()
  signatureImageId?: string;

  @ApiPropertyOptional({ description: 'Posición X en el PDF (pts)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  positionX?: number;

  @ApiPropertyOptional({ description: 'Posición Y en el PDF (pts)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  positionY?: number;

  @ApiPropertyOptional({ description: 'Ancho de la firma en pts' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  width?: number;

  @ApiPropertyOptional({ description: 'Alto de la firma en pts' })
  @IsOptional()
  @IsNumber()
  @Min(10)
  height?: number;

  @ApiPropertyOptional({ description: 'Orden de visualización' })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Etiqueta' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ description: 'Si la configuración está activa' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
