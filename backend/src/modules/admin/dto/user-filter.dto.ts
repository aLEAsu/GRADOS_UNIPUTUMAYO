import { IsOptional, IsString, IsBoolean, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../shared/dto/pagination-query.dto';
import { UserRole } from '../../../shared/decorators/roles.decorator';

export class UserFilterDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Filtrar por rol de usuario', enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({ description: 'Filtrar por estado activo/inactivo' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Búsqueda por email, nombre o apellido', example: 'juan' })
  @IsOptional()
  @IsString()
  search?: string;
}
