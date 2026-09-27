import type { DatabaseSync } from 'node:sqlite';
import { run } from '../db.ts';

export type ProductEvent = 'signed_up' | 'appointment_booked' | 'payment_completed' | 'account_deleted';

// Product events are queued in analytics_outbox for our weekly product report.
// Each payload carries the user's ID and email so the report can count unique
// patients across events.
export function recordEvent(
  db: DatabaseSync,
  event: ProductEvent,
  user: { id: string; email: string },
  details: Record<string, string | number | boolean> = {},
  now: Date = new Date(),
): void {
  const payload = { userId: user.id, email: user.email, ...details };
  run(
    db,
    'INSERT INTO analytics_outbox (event, payload_json, created_at) VALUES (?, ?, ?)',
    event,
    JSON.stringify(payload),
    now.toISOString(),
  );
}
