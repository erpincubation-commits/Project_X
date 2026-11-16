import { Catch, ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { diagnosticError } from '@erp/logging';
import { serverLog } from './logger';
import type { RequestWithId } from './request-logging';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<RequestWithId>();
    const detail = error as { type?: string; code?: string } | null;
    const databaseUnavailable = ['ECONNREFUSED','ECONNRESET','ETIMEDOUT','57P01','57P03','53300'].includes(detail?.code || '');
    const status = error instanceof HttpException ? error.getStatus() : detail?.type === 'entity.parse.failed' ? 400 : detail?.type === 'entity.too.large' ? 413 : databaseUnavailable ? 503 : 500;
    let message = status === 500 ? 'The server could not complete this request. Contact the administrator or retry.' : (error as HttpException).message;
    if (status === 400 && detail?.type === 'entity.parse.failed') message = 'The request body must contain valid JSON.';
    if (status === 413) message = 'The request is too large. Reduce the submitted data and try again.';
    if (databaseUnavailable) message = 'The database is unavailable. Retry shortly or contact the administrator.';
    if (error instanceof HttpException && status < 500) {
      const body = error.getResponse();
      if (typeof body === 'object' && 'message' in body) message = String(body.message);
    }
    if (status >= 500) serverLog.error('request.failed', { requestId: request.requestId, status, ...diagnosticError(error) });
    response.status(status).json({ message, statusCode: status, requestId: request.requestId });
  }
}
