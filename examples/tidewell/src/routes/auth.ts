import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.ts';
import { createUser, emailIsRegistered, findLoginByEmail } from '../accounts/users.ts';
import {
  consumeVerificationCode,
  issueVerificationCode,
  markVerified,
  SESSION_COOKIE,
  startSession,
} from '../accounts/sessions.ts';
import { recordEvent } from '../analytics/outbox.ts';
import { sendWelcomeEmail } from '../integrations/postmark.ts';
import { sendVerificationSms } from '../integrations/twilio.ts';
import { HttpError, parseBody } from '../lib/http.ts';
import { toE164 } from '../lib/phone.ts';

const SignupSchema = z.object({
  name: z.string().trim().min(1, 'Please tell us your name'),
  email: z.string().trim().email('Please enter a valid email address'),
  phone: z.string().trim().min(1, 'Please enter your phone number'),
  password: z.string().min(8, 'Use at least 8 characters'),
  marketingOptIn: z.boolean().default(false),
});

const LoginSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address'),
  password: z.string().min(1, 'Please enter your password'),
});

const VerifySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code we sent you'),
});

const sessionCookieOptions = { httpOnly: true, sameSite: 'lax', path: '/' } as const;

export function authRoutes(ctx: AppContext): Router {
  const router = Router();

  router.post('/signup', async (req, res) => {
    const input = parseBody(SignupSchema, req.body);
    const phone = toE164(input.phone);
    if (!phone) throw new HttpError(400, 'invalid_phone', 'Please enter a valid UK phone number.');
    if (emailIsRegistered(ctx.db, input.email)) {
      throw new HttpError(409, 'email_taken', 'That email address is already registered.');
    }

    const pwHash = await bcrypt.hash(input.password, ctx.settings.bcryptRounds);
    const user = createUser(ctx.db, {
      name: input.name,
      email: input.email,
      phone,
      pwHash,
      marketingOptIn: input.marketingOptIn,
    });

    await sendWelcomeEmail(ctx.settings, user.email, user.name).catch((err: unknown) =>
      ctx.logger.warn('welcome email failed', { userId: user.id, error: String(err) }),
    );
    recordEvent(ctx.db, 'signed_up', user, { marketingOptIn: user.marketingOptIn });

    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      marketingOptIn: user.marketingOptIn,
    });
  });

  router.post('/login', async (req, res) => {
    const input = parseBody(LoginSchema, req.body);
    const login = findLoginByEmail(ctx.db, input.email);
    const ok = login ? await bcrypt.compare(input.password, login.pwHash) : false;
    if (!login || !ok) {
      throw new HttpError(401, 'invalid_login', 'That email or password is not right.');
    }

    const session = startSession(ctx.db, login.user.id);
    res.cookie(SESSION_COOKIE, session.id, sessionCookieOptions);

    const code = issueVerificationCode(ctx.db, login.user.id);
    await sendVerificationSms(ctx.settings, login.user.phone, code).catch((err: unknown) =>
      ctx.logger.warn('verification sms failed', { userId: login.user.id, error: String(err) }),
    );

    res.json({ verificationRequired: true });
  });

  router.post('/login/verify', (req, res) => {
    if (!req.authed) throw new HttpError(401, 'not_signed_in', 'Please sign in first.');
    const { code } = parseBody(VerifySchema, req.body);
    if (!consumeVerificationCode(ctx.db, req.authed.session.userId, code)) {
      throw new HttpError(400, 'invalid_code', 'That code is not right or has expired.');
    }
    markVerified(ctx.db, req.authed.session.id);
    res.json({ verified: true });
  });

  return router;
}
