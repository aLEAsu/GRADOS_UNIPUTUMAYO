import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for assigning an advisor to a degree process
 */
export class AssignAdvisorDto {
  @ApiProperty({
    description: 'ID del usuario asesor a asignar (debe tener rol ADVISOR)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID()
  advisorUserId: string;
}
