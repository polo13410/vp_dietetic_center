import { Module } from '@nestjs/common';

import { PatientFileModule } from '../patient-file/patient-file.module';

import { PatientsController } from './patients.controller';
import { PatientsService } from './patients.service';

@Module({
  imports: [PatientFileModule],
  controllers: [PatientsController],
  providers: [PatientsService],
  exports: [PatientsService],
})
export class PatientsModule {}
