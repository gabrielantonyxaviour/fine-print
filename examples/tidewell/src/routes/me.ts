import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.ts';
import { softDeleteUser, updateProfile, type ProfileChanges } from '../accounts/users.ts';
import { recordEvent } from '../analytics/outbox.ts';
import { SESSION_COOKIE } from '../accounts/sessions.ts';
import { HttpError, parseBody } from '../lib/http.ts';
import { toE164 } from '../lib/phone.ts';
import { requireVerified } from '../middleware/session.ts';

const ProfileSchema = z
  .object({
    name: z.string().trim().min(1, 'Please tell us your name').optional(),
    phone: z.string().trim().min(1, 'Please enter your phone number').optional(),
    marketingOptIn: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'Nothing to update' });

export function meRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/me', (req, res) => {
    const { user } = requireVerified(req);
    res.json({ id: user.id, name: user.name, email: user.email, phone: user.phone, marketingOptIn: user.marketingOptIn });
  });

  router.patch('/me', (req, res) => {
    const { user } = requireVerified(req);
    const input = parseBody(ProfileSchema, req.body);

    const changes: ProfileChanges = {};
    if (input.name !== undefined) changes.name = input.name;
    if (input.marketingOptIn !== undefined) changes.marketingOptIn = input.marketingOptIn;
    if (input.phone !== undefined) {
      const phone = toE164(input.phone);
      if (!phone) throw new HttpError(400, 'invalid_phone', 'Please enter a valid UK phone number.');
      changes.phone = phone;
    }

    const updated = updateProfile(ctx.db, user.id, changes);
    if (!updated) throw new HttpError(404, 'not_found', 'Account not found.');
    res.json({ id: updated.id, name: updated.name, phone: updated.phone, marketingOptIn: updated.marketingOptIn });
  });

  router.post('/me/delete', (req, res) => {
    const { user } = requireVerified(req);
    softDeleteUser(ctx.db, user.id);
    recordEvent(ctx.db, 'account_deleted', user);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.json({ deleted: true });
  });

  return router;
}
