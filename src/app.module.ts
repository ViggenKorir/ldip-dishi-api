import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';

import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { BookmarkModule } from './bookmark/bookmark.module';
import { PrismaModule } from './prisma/prisma.module';
import { TestModule } from './test/test.module';
import { AppController } from './app.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { ProjectModule } from './project/project.module';
import { HealthModule } from './health/health.module';
import { validateEnv } from './common/config/env.validation';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { RequestContextGuard } from './common/guards/request-context.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    /** JSON logs, PII redacted; one line pretty output in development. */
    LoggerModule.forRoot({
      pinoHttp: {
        /**
         * Accept or generate X-Request-Id here so it is on the very first
         * log line of a request (guide §4). RequestContextGuard echoes it
         * back in the response header.
         */
        genReqId: (req) => {
          const inbound = req.headers['x-request-id'];
          return typeof inbound === 'string' && inbound.length <= 64
            ? inbound
            : crypto.randomUUID();
        },
        redact: {
          paths: [
            'req.headers.authorization',
            'req.body.password',
            'req.body.hash',
            'req.body.email',
            'req.body.mpesa_number',
            'req.body.phone',
          ],
          censor: '[redacted]',
        },
        autoLogging: {
          ignore: (req) => (req.url ?? '').startsWith('/health'),
        },
        transport:
          process.env.NODE_ENV === 'development'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    AuthModule,
    UserModule,
    BookmarkModule,
    PrismaModule,
    TestModule,
    SupabaseModule,
    ProjectModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_FILTER, useClass: ProblemDetailsFilter },
    { provide: APP_GUARD, useClass: RequestContextGuard },
  ],
})
export class AppModule {}
