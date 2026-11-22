import { Module } from '@nestjs/common';

import { InvoicesModule } from '../invoices/invoices.module';

import { ConsultationsService } from './consultations.service';
import { GpReportsService } from './gp-reports.service';
import { ConsultationsController, PatientFileController } from './patient-file.controller';
import { PatientFileService } from './patient-file.service';

@Module({
  imports: [InvoicesModule],
  controllers: [PatientFileController, ConsultationsController],
  providers: [PatientFileService, ConsultationsService, GpReportsService],
  exports: [PatientFileService],
})
export class PatientFileModule {}
