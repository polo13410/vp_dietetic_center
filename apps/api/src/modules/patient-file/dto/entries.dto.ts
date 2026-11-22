import { ApiProperty, ApiPropertyOptional, PartialType, PickType } from '@nestjs/swagger';
import { GpReportStatus, LifeEventCategory, MetricType } from '@prisma/client';
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

  @ApiProperty({ description: 'kg, cm or % depending on the type' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  value: number;

  @ApiPropertyOptional({ description: "Defaults to the session's date, or today" })
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

// ─── Medical file ─────────────────────────────────────────────────────────────

export class SaveFileFieldDto extends LinkedToSession {
  @ApiProperty({ description: 'The whole text of the section (empty to clear it)' })
  @IsString()
  @MaxLength(20000)
  content: string;
}

export class UpdateFileEntryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  content?: string;

  @ApiPropertyOptional({ description: 'Date of this version' })
  @IsOptional()
  @IsDateString()
  date?: string;
}

// ─── Life events ──────────────────────────────────────────────────────────────

export class CreateLifeEventDto extends LinkedToSession {
  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'One line' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ enum: LifeEventCategory, nullable: true })
  @IsOptional()
  @IsEnum(LifeEventCategory)
  category?: LifeEventCategory | null;
}

export class UpdateLifeEventDto extends PartialType(
  PickType(CreateLifeEventDto, ['date', 'title', 'category'] as const),
) {}

// ─── Reports to the GP ────────────────────────────────────────────────────────

export class CreateGpReportDto {
  @ApiPropertyOptional({ description: 'Defaults to today' })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Pre-filled from the file when left out' })
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  content?: string;
}

export class UpdateGpReportDto extends PartialType(CreateGpReportDto) {
  @ApiPropertyOptional({ enum: GpReportStatus, description: 'SENT records the sending date' })
  @IsOptional()
  @IsEnum(GpReportStatus)
  status?: GpReportStatus;
}
