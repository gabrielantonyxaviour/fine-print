import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context.ts';
import { searchClinics } from '../clinics/clinics.ts';

const QuerySchema = z.object({ q: z.string().default('') });

export function clinicRoutes(ctx: AppContext): Router {
  const router = Router();

  // Public clinic directory: anyone can browse before creating an account.
  router.get('/clinics', (req, res) => {
    const { q } = QuerySchema.parse({ q: typeof req.query.q === 'string' ? req.query.q : '' });
    res.json({ clinics: searchClinics(ctx.db, q) });
  });

  return router;
}
