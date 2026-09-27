import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.ts';
import { createAppointment } from '../appointments/appointments.ts';
import { getClinic } from '../clinics/clinics.ts';
import { recordEvent } from '../analytics/outbox.ts';
import { sendScheduleEvent } from '../integrations/meta.ts';
import { HttpError, parseBody } from '../lib/http.ts';
import { requireVerified } from '../middleware/session.ts';

const BookSchema = z.object({
  clinicId: z.string().trim().min(1, 'Please choose a clinic'),
  reason: z.string().trim().min(1, 'Please tell us the reason for your visit'),
  startsAt: z.string().datetime({ message: 'Please choose a valid date and time' }),
});

const SearchSchema = z.object({ q: z.string().default('') });

export function appointmentRoutes(ctx: AppContext): Router {
  const router = Router();

  router.post('/appointments', async (req, res) => {
    const { user } = requireVerified(req);
    const input = parseBody(BookSchema, req.body);

    const clinic = getClinic(ctx.db, input.clinicId);
    if (!clinic) throw new HttpError(404, 'clinic_not_found', 'We could not find that clinic.');

    const appointment = createAppointment(ctx.db, {
      userId: user.id,
      clinicId: clinic.id,
      reason: input.reason,
      startsAt: input.startsAt,
    });

    // Index the booking so the patient can search their own appointments.
    ctx.bookings.add({
      appointmentId: appointment.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      clinic: clinic.name,
      reason: appointment.reason,
      startsAt: appointment.startsAt,
    });

    recordEvent(ctx.db, 'appointment_booked', user, {
      clinicId: clinic.id,
      startsAt: appointment.startsAt,
    });

    // Measures booking conversions for our ads.
    await sendScheduleEvent(ctx.settings, {
      userId: user.id,
      clinicId: clinic.id,
      eventTime: Math.floor(Date.now() / 1000),
    }).catch((err: unknown) =>
      ctx.logger.warn('conversion event failed', { userId: user.id, error: String(err) }),
    );

    res.status(201).json({
      id: appointment.id,
      clinic: clinic.name,
      reason: appointment.reason,
      startsAt: appointment.startsAt,
    });
  });

  router.get('/appointments/search', (req, res) => {
    const { user } = requireVerified(req);
    const { q } = SearchSchema.parse({ q: typeof req.query.q === 'string' ? req.query.q : '' });
    res.json({ results: ctx.bookings.search(user.id, q) });
  });

  return router;
}
