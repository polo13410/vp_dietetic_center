import { PartialType } from '@nestjs/swagger';
import { AppointmentStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { CreateAppointmentDto } from './create-appointment.dto';

export class UpdateAppointmentDto extends PartialType(CreateAppointmentDto) {
  @IsOptional() @IsEnum(AppointmentStatus) status?: AppointmentStatus;
  @IsOptional() @IsString() postNotes?: string;
  @IsOptional() @IsString() cancelReason?: string;
}
