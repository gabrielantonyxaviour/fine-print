import type { ErrorRequestHandler } from 'express';
import type { z } from 'zod';
import type { Logger } from '../logger.ts';

// An error we expect and can explain to the client. Anything else is a 500.
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
  }
}

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  const where = issue && issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
  throw new HttpError(400, 'invalid_request', `${where}${issue?.message ?? 'Invalid request'}`);
}

type ParserError = { type?: unknown; status?: unknown };

function parserErrorType(err: unknown): string | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const type = (err as ParserError).type;
  return typeof type === 'string' ? type : undefined;
}

// API errors always have the shape { error, code }. Stack traces and database
// messages stay in the server log.
export function createErrorHandler(logger: Logger): ErrorRequestHandler {
  return (err, req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return;
    }
    const type = parserErrorType(err);
    if (type === 'entity.parse.failed') {
      res.status(400).json({ error: 'Request body is not valid JSON', code: 'invalid_json' });
      return;
    }
    if (type === 'entity.too.large') {
      res.status(413).json({ error: 'Request body is too large', code: 'body_too_large' });
      return;
    }
    logger.error('unhandled error', {
      method: req.method,
      path: req.path,
      error: err instanceof Error ? err.stack ?? err.message : String(err),
    });
    res.status(500).json({ error: 'Something went wrong on our side. Please try again.', code: 'internal_error' });
  };
}
