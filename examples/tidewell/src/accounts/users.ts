import type { DatabaseSync } from 'node:sqlite';
import { one, run, transaction } from '../db.ts';
import { newId } from '../lib/ids.ts';

type UserRow = {
  id: string;
  name: string;
  email: string;
  phone: string;
  pw_hash: string;
  marketing_opt_in: number;
  created_at: string;
  deleted_at: string | null;
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  marketingOptIn: boolean;
  createdAt: string;
};

export type NewUser = {
  name: string;
  email: string;
  phone: string;
  pwHash: string;
  marketingOptIn: boolean;
};

function toUser(row: UserRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    marketingOptIn: row.marketing_opt_in === 1,
    createdAt: row.created_at,
  };
}

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailIsRegistered(db: DatabaseSync, email: string): boolean {
  return one(db, 'SELECT id FROM users WHERE email = ?', normaliseEmail(email)) !== undefined;
}

export function createUser(db: DatabaseSync, input: NewUser, now: Date = new Date()): User {
  const id = newId('usr');
  run(
    db,
    `INSERT INTO users (id, name, email, phone, pw_hash, marketing_opt_in, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.name,
    normaliseEmail(input.email),
    input.phone,
    input.pwHash,
    input.marketingOptIn ? 1 : 0,
    now.toISOString(),
  );
  const user = getActiveUser(db, id);
  if (!user) throw new Error(`User ${id} was not created`);
  return user;
}

// Returns the account together with its hash, for sign-in only.
export function findLoginByEmail(db: DatabaseSync, email: string): { user: User; pwHash: string } | undefined {
  const row = one<UserRow>(
    db,
    'SELECT * FROM users WHERE email = ? AND deleted_at IS NULL',
    normaliseEmail(email),
  );
  return row ? { user: toUser(row), pwHash: row.pw_hash } : undefined;
}

export function getActiveUser(db: DatabaseSync, id: string): User | undefined {
  const row = one<UserRow>(db, 'SELECT * FROM users WHERE id = ? AND deleted_at IS NULL', id);
  return row ? toUser(row) : undefined;
}

export type ProfileChanges = { name?: string; phone?: string; marketingOptIn?: boolean };

export function updateProfile(db: DatabaseSync, id: string, changes: ProfileChanges): User | undefined {
  if (changes.name !== undefined) run(db, 'UPDATE users SET name = ? WHERE id = ?', changes.name, id);
  if (changes.phone !== undefined) run(db, 'UPDATE users SET phone = ? WHERE id = ?', changes.phone, id);
  if (changes.marketingOptIn !== undefined) {
    run(db, 'UPDATE users SET marketing_opt_in = ? WHERE id = ?', changes.marketingOptIn ? 1 : 0, id);
  }
  return getActiveUser(db, id);
}

// Marks the account as deleted and signs it out everywhere. The retention job
// removes the account's rows once the grace period has passed.
export function softDeleteUser(db: DatabaseSync, id: string, now: Date = new Date()): void {
  transaction(db, () => {
    run(db, 'UPDATE users SET deleted_at = ? WHERE id = ?', now.toISOString(), id);
    run(db, 'DELETE FROM sessions WHERE user_id = ?', id);
    run(db, 'DELETE FROM verification_codes WHERE user_id = ?', id);
  });
}
