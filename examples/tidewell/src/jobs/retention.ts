import type { AppContext } from '../context.ts';
import { all, run, transaction } from '../db.ts';

const GRACE_DAYS = 30;

// Retention clean-up. Accounts that were deleted more than 30 days ago are
// removed for good, along with the records tied to them.
export function runRetentionJobs(ctx: AppContext, now: Date = new Date()): void {
  const cutoff = new Date(now.getTime() - GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const expired = all<{ id: string }>(
    ctx.db,
    'SELECT id FROM users WHERE deleted_at IS NOT NULL AND deleted_at < ?',
    cutoff,
  );

  for (const { id } of expired) {
    transaction(ctx.db, () => {
      run(ctx.db, 'DELETE FROM payments WHERE user_id = ?', id);
      run(ctx.db, 'DELETE FROM appointments WHERE user_id = ?', id);
      run(ctx.db, 'DELETE FROM verification_codes WHERE user_id = ?', id);
      run(ctx.db, 'DELETE FROM sessions WHERE user_id = ?', id);
      run(ctx.db, 'DELETE FROM users WHERE id = ?', id);
    });
  }

  if (expired.length > 0) {
    ctx.logger.info('retention clean-up complete', { removed: expired.length, at: now.toISOString() });
  }
}
