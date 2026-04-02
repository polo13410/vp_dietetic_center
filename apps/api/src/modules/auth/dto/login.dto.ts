import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'praticienne@vp-dietetic.fr' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Pratic1234!' })
  @IsString()
  @MinLength(8)
  password: string;
}
