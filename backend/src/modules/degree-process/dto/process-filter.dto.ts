import { IsOptional, IsUUID, IsString, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';
import { ProcessStatus } from '../domain/process-state-machine';

/**
 * DTO for filtering degree processes with pagination
 */
export class ProcessFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por estado del proceso', enum: ProcessStatus })
  @IsOptional()
  @IsEnum(ProcessStatus)
  status?: ProcessStatus;

  @ApiPropertyOptional({ description: 'Filtrar por código de modalidad', example: 'THESIS' })
  @IsOptional()
  @IsString()
  modalityCode?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID del estudiante', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por ID del asesor', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  advisorId?: string;

  @ApiPropertyOptional({ description: 'Búsqueda por título o nombre de estudiante', example: 'microservicios' })
  @IsOptional()
  @IsString()
  search?: string;
}
