import { Module } from '@nestjs/common';

import { FormulasService } from './formulas.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { PracticesService } from './practices.service';

@Module({
  controllers: [MeController],
  providers: [MeService, FormulasService, PracticesService],
})
export class MeModule {}
