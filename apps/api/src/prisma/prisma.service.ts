import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('cleanDatabase is not allowed in production');
    }
    const tableNames = [
      'invoice',
      'audit_log',
      'task',
      'document',
      'gp_report',
      'life_event',
      'file_entry',
      'measurement',
      'consultation',
      'formula',
      'appointment',
      'consent',
      'patient',
      'user_preferences',
      'practitioner_profile',
      'refresh_token',
      'user',
    ];
    for (const tableName of tableNames) {
      await this.$executeRawUnsafe(`TRUNCATE TABLE "${tableName}" CASCADE`);
    }
  }
}
