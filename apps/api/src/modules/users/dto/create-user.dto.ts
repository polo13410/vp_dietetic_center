import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@vp-dietetic.fr' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Prénom' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Nom' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.ASSISTANTE })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}
