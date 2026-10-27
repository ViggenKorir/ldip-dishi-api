import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupSwagger } from './common/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  /**set the app to use validators globally */
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  /** Body size: this is a JSON API, keep the default 100 kb explicit-ish. */
  app.use(json({ limit: '256kb' }));

  /**
   * Security headers. CSP is off because Swagger UI ships inline scripts;
   * the API itself returns JSON and never renders HTML of its own.
   */
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  /**Comma-separated list of allowed frontend origins (credentials need explicit origins, not '*') */
  const config = app.get(ConfigService);
  const allowedOrigins = (
    config.get<string>('CORS_ORIGINS') || 'http://localhost:3000'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  /**Enable CORS */
  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true,
    exposedHeaders: ['X-Request-Id'],
  });

  /** Swagger per env (off by default in production; env validation already
   * refused the enabled-without-basic-auth combination). */
  if (config.get('SWAGGER_RESOLVED') === 'true') {
    setupSwagger(app);
  }

  /** Graceful shutdown: drain before exiting (guide §4). */
  app.enableShutdownHooks();

  /** Get the port from environment variables, with a fallback */
  const port = Number(config.get('PORT')) || 4000;

  await app.listen(port, '0.0.0.0');
  app.get(Logger).log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
