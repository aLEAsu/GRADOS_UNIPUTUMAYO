import { IsEnum, IsOptional, IsString, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalDecision } from '@prisma/client';

export class CreateApprovalDto {
  @ApiProperty({
    description: 'Decisión de aprobación',
    enum: ApprovalDecision,
    example: 'APPROVED',
  })
  @IsEnum(ApprovalDecision, {
    message: 'decision must be APPROVED, REJECTED, or REVISION_REQUESTED',
  })
  decision: ApprovalDecision;

  @ApiPropertyOptional({
    description: 'Observaciones del revisor (máx. 2000 caracteres)',
    example: 'El documento cumple con los requisitos establecidos.',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'observations must not exceed 2000 characters' })
  observations?: string;

  @ApiProperty({
    description: 'ID de la versión del documento a aprobar',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'documentVersionId must be a valid UUID' })
  documentVersionId: string;
}
