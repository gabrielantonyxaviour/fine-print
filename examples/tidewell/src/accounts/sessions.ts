import type { DatabaseSync } from 'node:sqlite';
import { one, run } from '../db.ts';
import { newSessionId, newVerificationCode } from '../lib/ids.ts';

export const SESSION_COOKIE = 'tw_session';
const CODE_TTL_MINUTES = 10;

type SessionRow = { id: string; user_id: string; verified: number; created_at: string };

export type Session = { id: string; userId: string; verified: boolean };

function toSession(row: SessionRow): Session {
  return { id: row.id, userId: row.user_id, verified: row.verified === 1 };
}

// A session starts unverified. Two-step verification flips it to verified once
// the patient enters the code we sent by SMS.
export function startSession(db: DatabaseSync, userId: string, now: Date = new Date()): Session {
  const id = newSessionId();
  run(
    db,
    'INSERT INTO sessions (id, user_id, verified, created_at) VALUES (?, ?, 0, ?)',
    id,
    userId,
    now.toISOString(),
  );
  return { id, userId, verified: false };
}

export function getSession(db: DatabaseSync, id: string): Session | undefined {
  const row = one<SessionRow>(db, 'SELECT * FROM sessions WHERE id = ?', id);
  return row ? toSession(row) : undefined;
}

export function markVerified(db: DatabaseSync, id: string): void {
  run(db, 'UPDATE sessions SET verified = 1 WHERE id = ?', id);
}

export function issueVerificationCode(db: DatabaseSync, userId: string, now: Date = new Date()): string {
  const code = newVerificationCode();
  const expires = new Date(now.getTime() + CODE_TTL_MINUTES * 60_000);
  run(db, 'DELETE FROM verification_codes WHERE user_id = ?', userId);
  run(
    db,
    'INSERT INTO verification_codes (user_id, code, expires_at) VALUES (?, ?, ?)',
    userId,
    code,
    expires.toISOString(),
  );
  return code;
}

export function consumeVerificationCode(
  db: DatabaseSync,
  userId: string,
  code: string,
  now: Date = new Date(),
): boolean {
  const row = one<{ code: string; expires_at: string }>(
    db,
    'SELECT code, expires_at FROM verification_codes WHERE user_id = ? ORDER BY expires_at DESC LIMIT 1',
    userId,
  );
  if (!row || row.code !== code) return false;
  if (new Date(row.expires_at).getTime() < now.getTime()) return false;
  run(db, 'DELETE FROM verification_codes WHERE user_id = ?', userId);
  return true;
}
