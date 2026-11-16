import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { serverLog } from './logger';

export type RequestWithId = Request & { requestId?: string };
export const requestIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function requestLogging(request: RequestWithId, response: Response, next: NextFunction) {
  const incoming = request.get('X-Request-ID');
  request.requestId = incoming && requestIdPattern.test(incoming) ? incoming : randomUUID();
  response.setHeader('X-Request-ID', request.requestId);
  response.setHeader('Cache-Control', 'no-store');
  const start = performance.now();
  let recorded = false;
  const finished = (aborted: boolean) => {
    if (recorded) return;
    recorded = true;
    const status = aborted ? 499 : response.statusCode;
    const fields = { requestId: request.requestId, method: ['GET','POST','PUT','PATCH','DELETE','HEAD','OPTIONS'].includes(request.method) ? request.method : 'OTHER', route: typeof request.route?.path === 'string' ? request.route.path : 'unmatched', status, durationMs: Math.round(performance.now() - start) };
    (status >= 500 ? serverLog.error : status >= 400 ? serverLog.warn : serverLog.info)('request.finished', fields);
  };
  response.once('finish', () => finished(false));
  response.once('close', () => finished(!response.writableFinished));
  next();
}
