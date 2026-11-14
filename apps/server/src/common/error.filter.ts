import { Catch, ExceptionFilter, ArgumentsHost, HttpException } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    let message = status === 500 ? 'The server could not complete this request. Contact the administrator or retry.' : (error as HttpException).message;
    if (error instanceof HttpException) {
      const body = error.getResponse();
      if (typeof body === 'object' && 'message' in body) message = String(body.message);
    }
    if (status === 500) console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
    response.status(status).json({ message, statusCode: status });
  }
}
