import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Indiquez votre mot de passe actuel.' })
  currentPassword: string;

  @ApiProperty({ minLength: 8, description: 'Au moins 8 caractères, une majuscule et un chiffre' })
  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit compter au moins 8 caractères.' })
  @MaxLength(128)
  @Matches(/^(?=.*[A-Z])(?=.*\d)/, {
    message: 'Le nouveau mot de passe doit contenir au moins une majuscule et un chiffre.',
  })
  newPassword: string;
}
