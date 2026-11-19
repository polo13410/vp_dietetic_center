import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateNutritionalEntryDto {
  @ApiProperty() @IsString() @IsNotEmpty() patientId: string;
  @ApiProperty() @IsDateString() date: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(999) weight?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(99) bmi?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10) mood?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10) energyLevel?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10) stressLevel?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(24) sleepHours?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(10) sleepQuality?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(99) waterIntake?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() physicalActivity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() mealNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() behaviorNotes?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() practitionerComment?: string;
}
