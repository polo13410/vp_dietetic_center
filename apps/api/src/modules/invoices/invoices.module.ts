import { Module } from '@nestjs/common';

import { InvoicesController, PatientInvoicesController, SessionInvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  controllers: [InvoicesController, SessionInvoicesController, PatientInvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}
