import type { DatabaseSync } from 'node:sqlite';
import { all, run } from '../db.ts';
import { newId } from '../lib/ids.ts';

export type Appointment = {
  id: string;
  userId: string;
  clinicId: string;
  reason: string;
  startsAt: string;
  createdAt: string;
};

type AppointmentRow = {
  id: string;
  user_id: string;
  clinic_id: string;
  reason: string;
  starts_at: string;
  created_at: string;
};

export function createAppointment(
  db: DatabaseSync,
  input: { userId: string; clinicId: string; reason: string; startsAt: string },
  now: Date = new Date(),
): Appointment {
  const id = newId('apt');
  run(
    db,
    `INSERT INTO appointments (id, user_id, clinic_id, reason, starts_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    id,
    input.userId,
    input.clinicId,
    input.reason,
    input.startsAt,
    now.toISOString(),
  );
  return {
    id,
    userId: input.userId,
    clinicId: input.clinicId,
    reason: input.reason,
    startsAt: input.startsAt,
    createdAt: now.toISOString(),
  };
}

export function listAppointments(db: DatabaseSync, userId: string): Appointment[] {
  const rows = all<AppointmentRow>(
    db,
    'SELECT * FROM appointments WHERE user_id = ? ORDER BY starts_at',
    userId,
  );
  return rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    clinicId: row.clinic_id,
    reason: row.reason,
    startsAt: row.starts_at,
    createdAt: row.created_at,
  }));
}
