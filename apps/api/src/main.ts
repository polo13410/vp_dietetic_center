import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Logger
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  // Security
  app.use(
    helmet({
      crossOriginEmbedderPolicy: false,
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [`'self'`],
          styleSrc: [`'self'`, `'unsafe-inline'`, 'https://accounts.google.com'],
          imgSrc: [`'self'`, 'data:', 'blob:', 'https://*.googleusercontent.com'],
          scriptSrc: [`'self'`, 'https://accounts.google.com', 'https://apis.google.com'],
          frameSrc: ['https://accounts.google.com'],
          connectSrc: [`'self'`, 'https://accounts.google.com'],
        },
      },
    }),
  );

  // Cookie parser
  app.use(cookieParser());

  // CORS
  const rawOrigins = config.get<string>('CORS_ORIGINS', 'http://localhost:5173');
  app.enableCors({
    origin: rawOrigins === '*' ? true : rawOrigins.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix + versioning
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Swagger — seulement hors production
  if (config.get('NODE_ENV') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VP Dietetic Center API')
      .setDescription('API REST pour la gestion du cabinet psycho-nutritionnel')
      .setVersion('1.0')
      .addBearerAuth()
      .addCookieAuth('refresh_token')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`🚀 API running on http://localhost:${port}/api/v1`);
  if (config.get('NODE_ENV') !== 'production') {
    logger.log(`📖 Swagger: http://localhost:${port}/api/docs`);
  }
}

bootstrap();
