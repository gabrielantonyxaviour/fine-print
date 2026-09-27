import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { createCanary, canaryFields } from '../src/canary/factory.ts';
import { scanStores, scanDir } from '../src/residue/scan.ts';
import type { DataStore } from '@fineprint/core';

let tempDirs: string[] = [];

function makeTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'fp-residue-test-'));
  tempDirs.push(d);
  return d;
}

afterEach(() => {
  for (const d of tempDirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
  tempDirs = [];
});

describe('residue scanner – sqlite', () => {
  it('finds canary email in a sqlite row with table.column location', () => {
    const dataDir = makeTempDir();
    const dbPath = join(dataDir, 'app.db');
    const canary = createCanary();
    const fields = canaryFields(canary);

    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)');
    db.prepare('INSERT INTO users (email) VALUES (?)').run(canary.email);
    db.close();

    const stores: DataStore[] = [{ id: 'app-db', kind: 'sqlite', location: 'app.db' }];
    const hits = scanStores(stores, dataDir, fields);

    const emailHit = hits.find((h) => h.matched.field === 'email' && h.location.includes('users.email'));
    expect(emailHit).toBeDefined();
    expect(emailHit?.location).toMatch(/users\.email \(rowid \d+\)/);
  });

  it('finds canary in raw bytes after DELETE (no secure_delete)', () => {
    const dataDir = makeTempDir();
    const dbPath = join(dataDir, 'app.db');
    const canary = createCanary();
    const fields = canaryFields(canary);

    const db = new DatabaseSync(dbPath);
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)');
    db.prepare('INSERT INTO users (email) VALUES (?)').run(canary.email);
    // Delete without secure_delete — data lingers in raw pages
    db.exec('DELETE FROM users');
    db.close();

    const stores: DataStore[] = [{ id: 'app-db', kind: 'sqlite', location: 'app.db' }];
    const hits = scanStores(stores, dataDir, fields);

    const rawHit = hits.find((h) => h.location === 'raw bytes (deleted but not erased)');
    expect(rawHit).toBeDefined();
  });

  it('finds nothing after DELETE with PRAGMA secure_delete = ON', () => {
    const dataDir = makeTempDir();
    const dbPath = join(dataDir, 'app.db');
    const canary = createCanary();
    const fields = canaryFields(canary);

    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA secure_delete = ON');
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT)');
    db.prepare('INSERT INTO users (email) VALUES (?)').run(canary.email);
    db.exec('DELETE FROM users');
    // Vacuum to ensure pages are rewritten
    db.exec('VACUUM');
    db.close();

    const stores: DataStore[] = [{ id: 'app-db', kind: 'sqlite', location: 'app.db' }];
    const hits = scanStores(stores, dataDir, fields);

    expect(hits).toHaveLength(0);
  });
});

describe('residue scanner – json-file', () => {
  it('finds canary email with JSON path location', () => {
    const dataDir = makeTempDir();
    const canary = createCanary();
    const fields = canaryFields(canary);

    const data = { users: [{ id: 1, email: canary.email, name: 'test' }] };
    writeFileSync(join(dataDir, 'users.json'), JSON.stringify(data), 'utf8');

    const stores: DataStore[] = [{ id: 'users-json', kind: 'json-file', location: 'users.json' }];
    const hits = scanStores(stores, dataDir, fields);

    const emailHit = hits.find((h) => h.matched.field === 'email');
    expect(emailHit).toBeDefined();
    expect(emailHit?.location).toBe('$.users[0].email');
  });
});

describe('residue scanner – file-glob', () => {
  it('finds canary in a log file with file:line location', () => {
    const dataDir = makeTempDir();
    const logsDir = join(dataDir, 'logs');
    mkdirSync(logsDir);
    const canary = createCanary();
    const fields = canaryFields(canary);

    writeFileSync(join(logsDir, 'app.log'), `[INFO] user login\n[INFO] email=${canary.email}\n[INFO] done\n`, 'utf8');

    const stores: DataStore[] = [{ id: 'app-logs', kind: 'file-glob', location: 'logs' }];
    const hits = scanStores(stores, dataDir, fields);

    const logHit = hits.find((h) => h.matched.field === 'email');
    expect(logHit).toBeDefined();
    expect(logHit?.location).toMatch(/^app\.log:\d+$/);
  });
});

describe('residue scanner – undeclared files', () => {
  it('finds canary in a file outside declared stores with storeId=undeclared', () => {
    const dataDir = makeTempDir();
    const canary = createCanary();
    const fields = canaryFields(canary);

    // Write to a location not covered by any store
    writeFileSync(join(dataDir, 'mystery.txt'), `some data: ${canary.email}`, 'utf8');

    // No stores declared
    const hits = scanDir(dataDir, fields, []);

    const undeclaredHit = hits.find((h) => h.storeId === 'undeclared');
    expect(undeclaredHit).toBeDefined();
    expect(undeclaredHit?.location).toBe('mystery.txt');
  });
});
