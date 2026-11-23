import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';

/** No password: the person signs in with the Google account of this address. */
export class CreateUserDto {
  @ApiProperty({ example: 'user@vp-dietetic.fr', description: 'Adresse de son compte Google' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email: string;

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
