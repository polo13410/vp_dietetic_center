import { Module } from '@nestjs/common';

import { FormulasService } from './formulas.service';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  controllers: [MeController],
  providers: [MeService, FormulasService],
})
export class MeModule {}
