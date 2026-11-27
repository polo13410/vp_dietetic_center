import { Module } from '@nestjs/common';

import { PatientFileModule } from '../patient-file/patient-file.module';

import { PatientImportController } from './patient-import.controller';
import { PatientImportService } from './patient-import.service';
import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [PatientFileModule],
  // The import first: « patients/import » is not a patient id
  controllers: [PatientImportController, PatientsController],
  providers: [PatientsService, PatientImportService],
  exports: [PatientsService],
})
export class PatientsModule {}
