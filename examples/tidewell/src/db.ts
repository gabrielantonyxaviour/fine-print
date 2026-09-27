import { DatabaseSync } from 'node:sqlite';
import type { SQLInputValue } from 'node:sqlite';

// Schema migrations, applied in order and tracked with PRAGMA user_version.
// Add new migrations to the end; never edit one that has shipped.
const MIGRATIONS: string[] = [
  `CREATE TABLE users (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     email TEXT NOT NULL UNIQUE,
     phone TEXT NOT NULL,
     pw_hash TEXT NOT NULL,
     marketing_opt_in INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     deleted_at TEXT NULL
   );
   CREATE TABLE sessions (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id),
     verified INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL
   );
   CREATE TABLE verification_codes (
     user_id TEXT NOT NULL REFERENCES users(id),
     code TEXT NOT NULL,
     expires_at TEXT NOT NULL
   );
   CREATE TABLE clinics (
     id TEXT PRIMARY KEY,
     name TEXT NOT NULL,
     city TEXT NOT NULL,
     services TEXT NOT NULL
   );
   CREATE TABLE appointments (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id),
     clinic_id TEXT NOT NULL REFERENCES clinics(id),
     reason TEXT NOT NULL,
     starts_at TEXT NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE TABLE payments (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id),
     stripe_pm TEXT,
     last4 TEXT NOT NULL,
     amount_pence INTEGER NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE TABLE analytics_outbox (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     event TEXT NOT NULL,
     payload_json TEXT NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE INDEX sessions_user ON sessions(user_id);
   CREATE INDEX appointments_user ON appointments(user_id);
   CREATE INDEX payments_user ON payments(user_id);`,
];

const CLINICS: Array<{ id: string; name: string; city: string; services: string[] }> = [
  { id: 'harbourside-physio-bristol', name: 'Harbourside Physio', city: 'Bristol', services: ['physiotherapy', 'sports injuries'] },
  { id: 'ashgrove-medical-leeds', name: 'Ashgrove Medical Practice', city: 'Leeds', services: ['gp appointments', 'travel vaccinations'] },
  { id: 'kelvin-street-physio-glasgow', name: 'Kelvin Street Physiotherapy', city: 'Glasgow', services: ['physiotherapy', 'back and neck pain'] },
  { id: 'meadowbank-surgery-edinburgh', name: 'Meadowbank Surgery', city: 'Edinburgh', services: ['gp appointments', 'minor illness'] },
  { id: 'castlegate-health-york', name: 'Castlegate Health Centre', city: 'York', services: ['gp appointments', 'physiotherapy'] },
  { id: 'quayside-sports-newcastle', name: 'Quayside Sports Clinic', city: 'Newcastle', services: ['physiotherapy', 'sports massage'] },
];

export function openDatabase(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  seedClinics(db);
  return db;
}

function migrate(db: DatabaseSync): void {
  const current = Number(db.prepare('PRAGMA user_version').get()?.user_version ?? 0);
  for (let version = current; version < MIGRATIONS.length; version++) {
    transaction(db, () => {
      db.exec(MIGRATIONS[version] ?? '');
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
}

function seedClinics(db: DatabaseSync): void {
  const insert = db.prepare('INSERT OR IGNORE INTO clinics (id, name, city, services) VALUES (?, ?, ?, ?)');
  for (const clinic of CLINICS) {
    insert.run(clinic.id, clinic.name, clinic.city, JSON.stringify(clinic.services));
  }
}

export function one<T>(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as unknown as T | undefined;
}

export function all<T>(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as unknown as T[];
}

export function run(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): number {
  return Number(db.prepare(sql).run(...params).changes);
}

export function transaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
