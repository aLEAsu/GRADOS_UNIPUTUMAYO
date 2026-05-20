import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'Email del usuario', example: 'estudiante@itp.edu.co' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contraseña', example: 'MiPassword123' })
  @IsString()
  password: string;
}
