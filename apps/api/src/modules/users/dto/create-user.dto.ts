import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'user@vp-dietetic.fr' })
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 8, description: 'Au moins 8 caracteres, 1 majuscule, 1 chiffre' })
  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le mot de passe doit contenir au moins une majuscule et un chiffre',
  })
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
