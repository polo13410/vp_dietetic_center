import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'abc123...' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NouveauMdp123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
