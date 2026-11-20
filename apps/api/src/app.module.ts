import type { IncomingMessage } from 'http';

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { AppController } from './app.controller';
import { AccessModule } from './common/access/access.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { configuration } from './config/configuration';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PatientFileModule } from './modules/patient-file/patient-file.module';
import { PatientsModule } from './modules/patients/patients.module';
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
        autoLogging: { ignore: (req: IncomingMessage) => req.url === '/api/v1/health' },
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),

    // Requests per client IP (sign-in endpoints have stricter limits, see AuthController)
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('throttle.ttl', 60000),
          limit: config.get<number>('throttle.limit', 300),
        },
      ],
    }),

    // Scheduler
    ScheduleModule.forRoot(),

    // Core
    PrismaModule,
    AccessModule,

    // Business modules
    AuthModule,
    UsersModule,
    PatientsModule,
    PatientFileModule,
    AppointmentsModule,
    DocumentsModule,
    TasksModule,
    SearchModule,
    NotificationsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [
    // Rate limiting first, so floods are refused before any other work
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
