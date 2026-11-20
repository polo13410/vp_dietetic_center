import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';
import { proxyTokenMiddleware } from './common/middleware/proxy-token.middleware';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });

  // Logger
  app.useLogger(app.get(Logger));

  const config = app.get(ConfigService);

  // Client IP (rate limits, sign-in history). Deployed, requests pass two proxies: Google's
  // front end, then the frontend's nginx, whose egress address Google appends. Trust exactly
  // those, so req.ip is the visitor's address and a forged X-Forwarded-For is ignored.
  const hops = config.get<string>('TRUST_PROXY_HOPS');
  app.set('trust proxy', hops ? Number(hops) : config.get('nodeEnv') === 'production' ? 2 : 'loopback');

  // Only the frontend may call the API (shared secret added by its nginx)
  app.use(proxyTokenMiddleware(config.get<string>('PROXY_TOKEN')));

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

  // No CORS: the app is served from the same origin as the API (nginx in deployed
  // environments, the Vite proxy in development), so browsers refuse other sites' calls.

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
