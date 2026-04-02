import { PartialType } from '@nestjs/swagger';
import { PatientStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

import { CreatePatientDto } from './create-patient.dto';

export class UpdatePatientDto extends PartialType(CreatePatientDto) {
  @IsOptional()
  @IsEnum(PatientStatus)
  status?: PatientStatus;

  @IsOptional()
  @IsString()
  privateNote?: string;
}
