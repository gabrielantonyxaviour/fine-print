import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../logger.ts';

// Access log: one JSON line per request with method, path, status and duration.
export function requestLog(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const path = req.originalUrl.split('?')[0] ?? req.path;
      const fields: Record<string, unknown> = {
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      };
      logger.debug('request', fields);
    });

    next();
  };
}
