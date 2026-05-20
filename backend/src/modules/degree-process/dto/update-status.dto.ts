import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ProcessStatus } from '../domain/process-state-machine';

/**
 * DTO for updating the status of a degree process
 */
export class UpdateStatusDto {
  @ApiProperty({
    description: 'Estado destino del proceso',
    enum: ProcessStatus,
    example: ProcessStatus.IN_REVIEW,
  })
  @IsEnum(ProcessStatus)
  status: ProcessStatus;
}
