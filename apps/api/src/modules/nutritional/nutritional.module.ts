import { Module } from '@nestjs/common';

import { NutritionalController } from './nutritional.controller';
import { NutritionalService } from './nutritional.service';

@Module({ controllers: [NutritionalController], providers: [NutritionalService] })
export class NutritionalModule {}
