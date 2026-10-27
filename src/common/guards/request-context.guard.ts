import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';

/**
 * Echoes or generates `X-Request-Id` (guide §4). The actual id is created by
 * pino-http's `genReqId` (app.module), so logs already carry it; this guard
 * guarantees the response header and provides a fallback when logging is
 * disabled (bare e2e runs). Also guards Swagger's basic auth when configured.
 */
@Injectable()
export class RequestContextGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const id =
      (request as Request & { id?: string }).id ??
      (typeof request.headers['x-request-id'] === 'string'
        ? (request.headers['x-request-id'] as string)
        : crypto.randomUUID());
    (request as Request & { id?: string }).id = id;
    response.setHeader('X-Request-Id', id);

    if (
      request.path.startsWith('/api/docs') &&
      this.swaggerCredentialsConfigured() &&
      !this.authorized(request)
    ) {
      response.setHeader('WWW-Authenticate', 'Basic realm="dishi-docs"');
      response.status(401).json({ message: 'Authentication required' });
      return false;
    }

    return true;
  }

  private swaggerCredentialsConfigured(): boolean {
    return Boolean(
      this.config.get('SWAGGER_BASIC_AUTH_USER') &&
        this.config.get('SWAGGER_BASIC_AUTH_PASS'),
    );
  }

  private authorized(request: Request): boolean {
    const header = request.headers.authorization ?? '';
    if (!header.startsWith('Basic ')) return false;
    const [user, pass] = Buffer.from(header.slice(6), 'base64')
      .toString('utf8')
      .split(':');
    return (
      user === this.config.get('SWAGGER_BASIC_AUTH_USER') &&
      pass === this.config.get('SWAGGER_BASIC_AUTH_PASS')
    );
  }
}
