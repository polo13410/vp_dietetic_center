import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class AppointmentQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number = 1;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number = 20;
  @ApiPropertyOptional() @IsOptional() @IsUUID() patientId?: string;
  @ApiPropertyOptional({ enum: AppointmentStatus }) @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
