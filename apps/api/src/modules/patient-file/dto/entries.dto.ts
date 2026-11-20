import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { GoalStatus, LifeEventCategory, MetricType, PatientTopic } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Anything recorded in the patient's file can belong to a session. */
class LinkedToSession {
  @ApiPropertyOptional({ description: 'Session during which it was recorded' })
  @IsOptional()
  @IsUUID()
  consultationId?: string;
}

// ─── Measurements ─────────────────────────────────────────────────────────────

export class CreateMeasurementDto extends LinkedToSession {
  @ApiProperty({ enum: MetricType })
  @IsEnum(MetricType)
  type: MetricType;

  @ApiProperty({ description: 'kg, cm, % or 1-10 depending on the type' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  value: number;

  @ApiPropertyOptional({ description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateMeasurementDto extends PartialType(
  PickType(CreateMeasurementDto, ['value', 'measuredAt', 'note'] as const),
) {}

// ─── Topic notes ──────────────────────────────────────────────────────────────

export class CreateTopicNoteDto extends LinkedToSession {
  @ApiProperty({ enum: PatientTopic })
  @IsEnum(PatientTopic)
  topic: PatientTopic;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  content: string;
}

export class UpdateTopicNoteDto extends PickType(CreateTopicNoteDto, ['content'] as const) {}

// ─── Life events ──────────────────────────────────────────────────────────────

export class CreateLifeEventDto extends LinkedToSession {
  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  @ApiPropertyOptional({ enum: LifeEventCategory })
  @IsOptional()
  @IsEnum(LifeEventCategory)
  category?: LifeEventCategory;
}

export class UpdateLifeEventDto extends PartialType(
  PickType(CreateLifeEventDto, ['date', 'title', 'description', 'category'] as const),
) {}

// ─── Goals ────────────────────────────────────────────────────────────────────

export class CreateGoalDto extends LinkedToSession {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  details?: string;
}

export class UpdateGoalDto extends PartialType(
  PickType(CreateGoalDto, ['title', 'details'] as const),
) {
  @ApiPropertyOptional({ enum: GoalStatus })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;
}
