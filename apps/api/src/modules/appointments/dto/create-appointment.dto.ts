import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateIf } from 'class-validator';

/** Optional, but when sent it may be null (cleared). */
const nullable = ValidateIf((_, value) => value !== null && value !== undefined);
const trimToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || null : value;

export class CreateAppointmentDto {
  @ApiProperty() @IsUUID() patientId: string;
  @ApiProperty() @IsDateString() startAt: string;

  @ApiPropertyOptional({ minimum: 15, maximum: 480, description: 'Minutes; by default the duration of the type' })
  @IsOptional()
  @IsInt({ message: 'Indiquez la durée en minutes.' })
  @Min(15, { message: 'Comptez au moins 15 minutes.' })
  @Max(480, { message: 'La durée ne peut pas dépasser 8 heures.' })
  duration?: number;

  @ApiProperty({ enum: AppointmentType })
  @IsEnum(AppointmentType)
  type: AppointmentType;

  @ApiPropertyOptional({ nullable: true, description: 'Type of appointment: one of the formulas' })
  @nullable
  @IsUUID()
  formulaId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'In person: by default the default practice. Ignored for video and phone.',
  })
  @nullable
  @IsUUID()
  practiceId?: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Optional note' })
  @Transform(trimToNull)
  @nullable
  @IsString()
  @MaxLength(2000)
  reason?: string | null;
}
