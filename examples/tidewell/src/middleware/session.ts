import type { NextFunction, Request, Response } from 'express';
import type { AppContext } from '../context.ts';
import { getActiveUser, type User } from '../accounts/users.ts';
import { getSession, SESSION_COOKIE, type Session } from '../accounts/sessions.ts';
import { HttpError } from '../lib/http.ts';

// The session cookie value is read from a single Cookie header. We only ever
// look for our own tw_session cookie.
function readSessionCookie(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

export type Authed = { session: Session; user: User };

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      authed?: Authed;
    }
  }
}

// Loads the current session and user (if any) onto the request. Never rejects;
// route guards decide what a given endpoint requires.
export function attachSession(ctx: AppContext) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const sessionId = readSessionCookie(req.headers.cookie);
    if (sessionId) {
      const session = getSession(ctx.db, sessionId);
      if (session) {
        const user = getActiveUser(ctx.db, session.userId);
        if (user) req.authed = { session, user };
      }
    }
    next();
  };
}

export function requireVerified(req: Request): Authed {
  if (!req.authed) throw new HttpError(401, 'not_signed_in', 'Please sign in to continue.');
  if (!req.authed.session.verified) {
    throw new HttpError(403, 'verification_required', 'Please complete two-step verification.');
  }
  return req.authed;
}
