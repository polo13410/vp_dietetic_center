import type { IncomingMessage } from 'http';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { configuration } from './config/configuration';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotesModule } from './modules/notes/notes.module';
import { NutritionalModule } from './modules/nutritional/nutritional.module';
import { PatientsModule } from './modules/patients/patients.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SearchModule } from './modules/search/search.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['.env.local', '.env'],
    }),

    // Logger structuré (pino)
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/health' },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),

    // Throttler
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 100 },
      { name: 'auth', ttl: 60000, limit: 10 },
    ]),

    // Scheduler
    ScheduleModule.forRoot(),

    // Core
    PrismaModule,

    // Business modules
    AuthModule,
    UsersModule,
    PatientsModule,
    AppointmentsModule,
    NotesModule,
    NutritionalModule,
    DocumentsModule,
    TasksModule,
    SearchModule,
    ReportsModule,
    AuditModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
