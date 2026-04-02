import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentType } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateAppointmentDto {
  @ApiProperty() @IsUUID() patientId: string;
  @ApiProperty() @IsDateString() startAt: string;

  @ApiProperty({ minimum: 15 })
  @IsInt()
  @Min(15)
  duration: number;

  @ApiProperty({ enum: AppointmentType })
  @IsEnum(AppointmentType)
  type: AppointmentType;

  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preNotes?: string;
}
