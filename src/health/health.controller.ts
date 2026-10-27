import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * `GET /health/live` proves the process is up.
 * `GET /health/ready` also proves Postgres answers.
 * Both are public and unthrottled (guide §4).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('live')
  @HealthCheck()
  @ApiOperation({ summary: 'Process liveness; no dependencies checked' })
  live(): Promise<HealthCheckResult> {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  @ApiOperation({ summary: 'Database reachable' })
  async ready(): Promise<HealthCheckResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        info: {},
        error: { database: { status: 'down' } },
        details: { database: { status: 'down' } },
      });
    }
    return {
      status: 'ok',
      info: { database: { status: 'up' } },
      error: {},
      details: { database: { status: 'up' } },
    } as HealthCheckResult;
  }
}
