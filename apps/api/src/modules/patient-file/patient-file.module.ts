import { Module } from '@nestjs/common';

import { ConsultationsService } from './consultations.service';
import { GpReportsService } from './gp-reports.service';
import { ConsultationsController, PatientFileController } from './patient-file.controller';
import { PatientFileService } from './patient-file.service';

@Module({
  controllers: [PatientFileController, ConsultationsController],
  providers: [PatientFileService, ConsultationsService, GpReportsService],
  exports: [PatientFileService],
})
export class PatientFileModule {}
