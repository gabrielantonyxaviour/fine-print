import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { findCanaries } from '../canary/match.ts';
import type { DataStore } from '@fineprint/core';

export interface ResidueHit {
  storeId: string;
  location: string;
  matched: { field: string; form: string };
}

function scanBytes(
  bytes: Uint8Array,
  fields: { field: string; value: string }[],
): { field: string; form: string }[] {
  return findCanaries(bytes, fields);
}

function walkJson(
  value: unknown,
  path: string,
  fields: { field: string; value: string }[],
  hits: ResidueHit[],
  storeId: string,
): void {
  if (typeof value === 'string') {
    const matched = findCanaries(value, fields);
    for (const m of matched) {
      hits.push({ storeId, location: path, matched: m });
    }
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      walkJson(value[i], `${path}[${i}]`, fields, hits, storeId);
    }
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      walkJson(child, `${path}.${key}`, fields, hits, storeId);
    }
  }
}

function scanSqliteStore(
  storeId: string,
  filePath: string,
  dataDir: string,
  fields: { field: string; value: string }[],
): ResidueHit[] {
  const hits: ResidueHit[] = [];
  if (!existsSync(filePath)) return hits;

  // Row-level scan
  const rowHitKeys = new Set<string>();
  let db: InstanceType<typeof DatabaseSync> | undefined;
  try {
    db = new DatabaseSync(filePath, { open: true });
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[]).map(
      (r) => r.name,
    );

    for (const table of tables) {
      let rows: Record<string, unknown>[];
      try {
        rows = db.prepare(`SELECT rowid AS _rowid_, * FROM "${table}"`).all() as Record<string, unknown>[];
      } catch {
        continue;
      }
      for (const row of rows) {
        const rowid = row['_rowid_'];
        for (const [col, cellValue] of Object.entries(row)) {
          if (col === '_rowid_') continue;
          if (typeof cellValue !== 'string') continue;
          const matched = findCanaries(cellValue, fields);
          for (const m of matched) {
            const key = `${m.field}:${m.form}`;
            rowHitKeys.add(key);
            hits.push({ storeId, location: `${table}.${col} (rowid ${rowid})`, matched: m });
          }
        }
      }
    }
  } catch {
    // DB may be locked or invalid
  } finally {
    try {
      db?.close();
    } catch {
      // ignore
    }
  }

  // Raw bytes scan of the db file and WAL/journal
  const filesToScan: string[] = [filePath, `${filePath}-wal`, `${filePath}-journal`];
  for (const f of filesToScan) {
    if (!existsSync(f)) continue;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(readFileSync(f));
    } catch {
      continue;
    }
    const rawMatches = scanBytes(bytes, fields);
    for (const m of rawMatches) {
      const key = `${m.field}:${m.form}`;
      if (!rowHitKeys.has(key)) {
        hits.push({ storeId, location: 'raw bytes (deleted but not erased)', matched: m });
      }
    }
  }

  return hits;
}

function scanJsonFile(
  storeId: string,
  filePath: string,
  fields: { field: string; value: string }[],
): ResidueHit[] {
  const hits: ResidueHit[] = [];
  if (!existsSync(filePath)) return hits;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return hits;
  }
  walkJson(parsed, '$', fields, hits, storeId);
  return hits;
}

function scanFileGlob(
  storeId: string,
  folder: string,
  fields: { field: string; value: string }[],
): ResidueHit[] {
  const hits: ResidueHit[] = [];
  if (!existsSync(folder)) return hits;
  let entries: string[];
  try {
    entries = readdirSync(folder);
  } catch {
    return hits;
  }
  for (const entry of entries) {
    const full = join(folder, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    let text: string;
    try {
      text = readFileSync(full, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? '';
      const matched = findCanaries(line, fields);
      for (const m of matched) {
        hits.push({ storeId, location: `${entry}:${i + 1}`, matched: m });
      }
    }
  }
  return hits;
}

function scanDirBytes(
  storeId: string,
  dirPath: string,
  baseDir: string,
  fields: { field: string; value: string }[],
): ResidueHit[] {
  const hits: ResidueHit[] = [];
  if (!existsSync(dirPath)) return hits;

  function recurse(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        recurse(full);
      } else if (stat.isFile()) {
        let bytes: Uint8Array;
        try {
          bytes = new Uint8Array(readFileSync(full));
        } catch {
          continue;
        }
        const matched = scanBytes(bytes, fields);
        for (const m of matched) {
          hits.push({ storeId, location: relative(baseDir, full), matched: m });
        }
      }
    }
  }

  recurse(dirPath);
  return hits;
}

function coveredPaths(stores: DataStore[], dataDir: string): Set<string> {
  const covered = new Set<string>();
  for (const store of stores) {
    const abs = join(dataDir, store.location);
    covered.add(abs);
    if (store.kind === 'sqlite') {
      covered.add(`${abs}-wal`);
      covered.add(`${abs}-journal`);
    }
  }
  return covered;
}

export function scanStores(
  stores: DataStore[],
  dataDir: string,
  fields: { field: string; value: string }[],
): ResidueHit[] {
  const hits: ResidueHit[] = [];
  for (const store of stores) {
    const absLocation = join(dataDir, store.location);
    if (store.kind === 'sqlite' || store.kind === 'sqlite-table') {
      hits.push(...scanSqliteStore(store.id, absLocation, dataDir, fields));
    } else if (store.kind === 'json-file') {
      hits.push(...scanJsonFile(store.id, absLocation, fields));
    } else if (store.kind === 'file-glob') {
      hits.push(...scanFileGlob(store.id, absLocation, fields));
    } else if (store.kind === 'dir') {
      hits.push(...scanDirBytes(store.id, absLocation, absLocation, fields));
    }
  }
  return hits;
}

export function scanDir(
  dataDir: string,
  fields: { field: string; value: string }[],
  declaredStores: DataStore[] = [],
): ResidueHit[] {
  const covered = coveredPaths(declaredStores, dataDir);
  const hits: ResidueHit[] = [];
  if (!existsSync(dataDir)) return hits;

  function recurse(dir: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      if (covered.has(full)) continue;
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        recurse(full);
      } else if (stat.isFile()) {
        let bytes: Uint8Array;
        try {
          bytes = new Uint8Array(readFileSync(full));
        } catch {
          continue;
        }
        const matched = scanBytes(bytes, fields);
        for (const m of matched) {
          hits.push({ storeId: 'undeclared', location: relative(dataDir, full), matched: m });
        }
      }
    }
  }

  recurse(dataDir);
  return hits;
}
