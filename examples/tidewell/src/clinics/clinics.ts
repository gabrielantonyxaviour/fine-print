import type { DatabaseSync } from 'node:sqlite';
import { all, one } from '../db.ts';

type ClinicRow = { id: string; name: string; city: string; services: string };

export type Clinic = { id: string; name: string; city: string; services: string[] };

function toClinic(row: ClinicRow): Clinic {
  const parsed = JSON.parse(row.services) as unknown;
  const services = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  return { id: row.id, name: row.name, city: row.city, services };
}

// Free-text clinic search across name, city and the services on offer.
export function searchClinics(db: DatabaseSync, query: string): Clinic[] {
  const rows = all<ClinicRow>(db, 'SELECT * FROM clinics ORDER BY name');
  const needle = query.trim().toLowerCase();
  const clinics = rows.map(toClinic);
  if (needle === '') return clinics;
  return clinics.filter((clinic) =>
    [clinic.name, clinic.city, ...clinic.services].some((field) =>
      field.toLowerCase().includes(needle),
    ),
  );
}

export function getClinic(db: DatabaseSync, id: string): Clinic | undefined {
  const row = one<ClinicRow>(db, 'SELECT * FROM clinics WHERE id = ?', id);
  return row ? toClinic(row) : undefined;
}
