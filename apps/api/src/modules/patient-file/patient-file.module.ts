import { Module } from '@nestjs/common';

import { ConsultationsService } from './consultations.service';
import { ConsultationsController, PatientFileController } from './patient-file.controller';
import { PatientFileService } from './patient-file.service';

@Module({
  controllers: [PatientFileController, ConsultationsController],
  providers: [PatientFileService, ConsultationsService],
  exports: [PatientFileService],
})
export class PatientFileModule {}
