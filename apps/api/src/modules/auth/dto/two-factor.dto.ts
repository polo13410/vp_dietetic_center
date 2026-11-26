import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class TwoFactorDto {
  @ApiProperty({ description: 'Challenge returned by POST /auth/google' })
  @IsString()
  @IsNotEmpty()
  challengeToken: string;

  @ApiProperty({ description: '6-digit code of the authenticator app, or a recovery code' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string;
}
