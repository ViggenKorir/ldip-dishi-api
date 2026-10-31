import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configuredOrigins = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS ?? '').split(','),
  ]
    .map((origin) => origin?.trim())
    .filter((origin): origin is string => Boolean(origin))
    .map((origin) => new URL(origin).origin);
  const allowedOrigins = [
    ...new Set([
      ...configuredOrigins,
      ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000']),
    ]),
  ];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const config = new DocumentBuilder()
    .setTitle('Dishi API')
    .setDescription('Vendors, menus, orders, payments and payouts for Dishi')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'supabase-jwt',
    )
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));

  await app.listen(process.env.PORT ?? 3001, '0.0.0.0'); // Render needs 0.0.0.0 and $PORT
}
bootstrap();
