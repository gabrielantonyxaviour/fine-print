import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../logger.ts';

// Auth endpoints where we capture the parsed request body at debug level to
// troubleshoot sign-in issues (LOG_LEVEL=debug). Sign-in problems are our most
// common support ticket, and seeing the exact submitted fields makes them quick
// to reproduce.
const BODY_LOG_PREFIXES = ['/api/signup', '/api/login'];

function shouldLogBody(path: string): boolean {
  return BODY_LOG_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

// Access log: one JSON line per request with method, path, status and duration.
export function requestLog(logger: Logger) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startedAt = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const fields: Record<string, unknown> = {
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      };
      if (shouldLogBody(req.path)) fields.body = req.body;
      logger.debug('request', fields);
    });

    next();
  };
}
