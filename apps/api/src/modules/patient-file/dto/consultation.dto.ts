import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GoalStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateConsultationDto {
  @ApiPropertyOptional({ description: 'Appointment this session comes from (at most one session each)' })
  @IsOptional()
  @IsUUID()
  appointmentId?: string;

  @ApiPropertyOptional({ description: "Defaults to the appointment's start, or now" })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class UpdateConsultationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'What happened, what was said' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  summary?: string;

  @ApiPropertyOptional({ description: 'Advice and plan given to the patient' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  advice?: string;
}

export class ReviewGoalDto {
  @ApiProperty({ enum: GoalStatus })
  @IsEnum(GoalStatus)
  status: GoalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}
