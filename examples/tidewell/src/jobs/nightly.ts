import type { AppContext } from '../context.ts';
import { all } from '../db.ts';
import { subscribeMember } from '../integrations/mailchimp.ts';
import { uploadPhoneAudience } from '../integrations/meta.ts';

// Nightly marketing sync. Runs once a night from the scheduler.
export async function runNightlyJobs(ctx: AppContext, now: Date = new Date()): Promise<void> {
  await syncNewsletter(ctx);
  await syncLookalikeAudience(ctx);
  ctx.logger.info('nightly jobs complete', { at: now.toISOString() });
}

// Keep the Mailchimp newsletter audience in step with who has opted in.
async function syncNewsletter(ctx: AppContext): Promise<void> {
  const members = all<{ email: string }>(
    ctx.db,
    'SELECT email FROM users WHERE deleted_at IS NULL AND marketing_opt_in = 1',
  );
  for (const member of members) {
    await subscribeMember(ctx.settings, member.email).catch((err: unknown) =>
      ctx.logger.warn('mailchimp sync failed', { error: String(err) }),
    );
  }
}

// Refresh the lookalike audience so campaigns can reach more patients like ours.
async function syncLookalikeAudience(ctx: AppContext): Promise<void> {
  const rows = all<{ phone: string }>(
    ctx.db,
    'SELECT phone FROM users WHERE deleted_at IS NULL',
  );
  const phones = rows.map((row) => row.phone);
  await uploadPhoneAudience(ctx.settings, phones).catch((err: unknown) =>
    ctx.logger.warn('audience sync failed', { error: String(err) }),
  );
}
