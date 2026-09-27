import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.ts';
import { recordEvent } from '../analytics/outbox.ts';
import { run } from '../db.ts';
import { createPaymentMethod } from '../integrations/stripe.ts';
import { newId } from '../lib/ids.ts';
import { parseBody } from '../lib/http.ts';
import { requireVerified } from '../middleware/session.ts';

const PaymentSchema = z.object({
  cardNumber: z.string().trim().regex(/^\d{12,19}$/, 'Enter a valid card number'),
  expMonth: z.coerce.number().int().min(1).max(12),
  expYear: z.coerce.number().int().min(2024).max(2100),
  cvc: z.string().trim().regex(/^\d{3,4}$/, 'Enter the security code'),
  amountPence: z.coerce.number().int().positive('Enter an amount to pay'),
});

export function paymentRoutes(ctx: AppContext): Router {
  const router = Router();

  router.post('/payments', async (req, res) => {
    const { user } = requireVerified(req);
    const input = parseBody(PaymentSchema, req.body);

    // Stripe tokenises the card; we keep only the reference and last four digits.
    const method = await createPaymentMethod(ctx.settings, {
      number: input.cardNumber,
      expMonth: input.expMonth,
      expYear: input.expYear,
      cvc: input.cvc,
    });

    const id = newId('pay');
    run(
      ctx.db,
      `INSERT INTO payments (id, user_id, stripe_pm, last4, amount_pence, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      id,
      user.id,
      method.id,
      method.last4,
      input.amountPence,
      new Date().toISOString(),
    );

    recordEvent(ctx.db, 'payment_completed', user, { amountPence: input.amountPence });

    res.status(201).json({ id, last4: method.last4, amountPence: input.amountPence });
  });

  return router;
}
