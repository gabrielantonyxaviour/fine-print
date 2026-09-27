import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.ts';
import { one } from '../db.ts';
import { runNightlyJobs } from '../jobs/nightly.ts';
import { runRetentionJobs } from '../jobs/retention.ts';
import { parseBody } from '../lib/http.ts';
import { toE164 } from '../lib/phone.ts';

const RunJobsSchema = z.object({
  now: z.string().datetime(),
  which: z.enum(['nightly', 'retention', 'all']),
});

// Helpers used by the automated test suite. They are mounted only in the test
// environment (NODE_ENV=test or createApp({ testRoutes: true })).
export function testRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get('/last-code', (req, res) => {
    const raw = typeof req.query.phone === 'string' ? req.query.phone : '';
    const phone = toE164(raw) ?? raw;
    const row = one<{ code: string }>(
      ctx.db,
      `SELECT vc.code FROM verification_codes vc
       JOIN users u ON u.id = vc.user_id
       WHERE u.phone = ?
       ORDER BY vc.expires_at DESC LIMIT 1`,
      phone,
    );
    if (!row) {
      res.status(404).json({ error: 'No code found for that phone', code: 'not_found' });
      return;
    }
    res.json({ code: row.code });
  });

  router.post('/run-jobs', async (req, res) => {
    const { now, which } = parseBody(RunJobsSchema, req.body);
    const clock = new Date(now);
    if (which === 'nightly' || which === 'all') await runNightlyJobs(ctx, clock);
    if (which === 'retention' || which === 'all') runRetentionJobs(ctx, clock);
    res.json({ ran: which, now });
  });

  return router;
}
