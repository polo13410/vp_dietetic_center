import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateNutritionalProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() objectives?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() dietaryHabits?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() foodRelationship?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() emotionalTriggers?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() allergies?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() intolerances?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() supplements?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() medications?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() activityLevel?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() sleepPattern?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() stressLevel?: string | null;
}
