import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * One global exception filter: RFC 7807 `application/problem+json`
 * (guide §4). Every error carries a stable `code` the frontend maps to
 * friendly copy, plus the `requestId` for support.
 *
 * `message` and `statusCode` are kept alongside the problem fields so
 * consumers that predate this shape (the running Next app reads
 * `error.message`) keep working during the parallel run.
 */

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_FAILED',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'VALIDATION_FAILED',
  429: 'RATE_LIMITED',
};

type RequestWithId = Request & { id?: string };

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const raw =
      exception instanceof HttpException ? exception.getResponse() : undefined;

    let detail = '';
    let fieldErrors: { field?: string; message: string }[] | undefined;
    let code: string | undefined;

    if (typeof raw === 'string') {
      detail = raw;
    } else if (raw && typeof raw === 'object') {
      const body = raw as Record<string, unknown>;
      if (Array.isArray(body.message)) {
        fieldErrors = (body.message as string[]).map((message) => ({ message }));
        detail = body.message.join('; ');
      } else if (typeof body.message === 'string') {
        detail = body.message;
      }
      if (typeof body.code === 'string') code = body.code;
    }

    if (status >= 500) {
      // Only unknown crashes get the generic treatment: an HttpException
      // message is authored by us and is safe to show (e.g. 503 "Social
      // sign-in is not configured"). The request logger keeps the real error.
      if (!(exception instanceof HttpException)) {
        (
          request as unknown as {
            log?: { error?: (o: unknown, m: string) => void };
          }
        ).log?.error?.({ err: exception }, 'unhandled error');
        detail = 'Internal server error';
      }
    }

    const problem: Record<string, unknown> = {
      type: 'https://docs.dishi.app/errors',
      title: code ?? CODE_BY_STATUS[status] ?? 'INTERNAL',
      status,
      detail: detail || 'Error',
      code: code ?? CODE_BY_STATUS[status] ?? 'INTERNAL',
      requestId: request.id ?? 'unknown',
      // Legacy fields for the running frontend during the parallel run.
      message: detail || 'Error',
      statusCode: status,
    };
    if (fieldErrors) problem.errors = fieldErrors;

    response
      .status(status)
      .type('application/problem+json')
      .json(problem);
  }
}
