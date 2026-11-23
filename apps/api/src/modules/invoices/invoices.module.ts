import { Module } from '@nestjs/common';

import { InvoicesController, PatientInvoicesController, SessionInvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';
import { PayerInvoicesService } from './payer-invoices.service';
import { PatientCoveragesController, PayerInvoicesController, PayersController } from './payers.controller';
import { PayersService } from './payers.service';

@Module({
  controllers: [
    InvoicesController,
    SessionInvoicesController,
    PatientInvoicesController,
    PayersController,
    PayerInvoicesController,
    PatientCoveragesController,
  ],
  providers: [InvoicesService, PayerInvoicesService, PayersService],
  exports: [InvoicesService, PayersService],
})
export class InvoicesModule {}
