// Shared helpers for grading a Fine Print audit of Tidewell against GROUND_TRUTH.json.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TIDEWELL = join(dirname(fileURLToPath(import.meta.url)), '..');
export const REPO = join(TIDEWELL, '..', '..');

export const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
export const groundTruth = () => readJson(join(TIDEWELL, 'GROUND_TRUTH.json')).statements;

// Categories Fine Print may reasonably choose for each statement.
export const ACCEPTABLE = {
  '3.2': ['purpose_limitation', 'sharing'],
  '4.3': ['sharing'],
  '5.1': ['security_storage'],
  '6.1': ['retention_deletion'],
};

export function normalize(text) {
  return String(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.\s]+$/, '')
    .toLowerCase();
}

// A promise matches a statement when its quote equals or contains the statement.
export function findMatch(items, statement) {
  const want = normalize(statement.quote);
  return items.find((item) => {
    const got = normalize(item.quote ?? '');
    return got === want || got.includes(want);
  });
}

export function gradeExtract(promises, statements = groundTruth()) {
  const rows = [];
  const matched = new Set();
  for (const s of statements) {
    const p = findMatch(promises, s);
    if (!p) { rows.push({ section: s.section, ok: false, note: 'not extracted' }); continue; }
    matched.add(p);
    const allowed = ACCEPTABLE[s.section] ?? [s.expectedCategory];
    const problems = [];
    if (String(p.section) !== s.section) problems.push(`section ${p.section} != ${s.section}`);
    if (!allowed.includes(p.category)) problems.push(`category ${p.category} not in ${allowed.join('/')}`);
    if (s.expectedCategory === 'human_review' && p.testability !== 'human_review') problems.push('should be human_review');
    rows.push({ section: s.section, ok: problems.length === 0, note: problems.join('; ') || p.id });
  }
  for (const p of promises) {
    if (!matched.has(p) && p.testability !== 'human_review') {
      rows.push({ section: p.section, ok: false, note: `unexpected testable promise ${p.id}` });
    }
  }
  return rows;
}

export function gradeLedger(entries, stage, statements = groundTruth()) {
  const key = stage === 'fix' ? 'expectedVerdictAfterFix' : 'expectedVerdictBefore';
  return statements.map((s) => {
    const e = findMatch(entries, s);
    if (!e) return { section: s.section, ok: false, note: 'no ledger entry' };
    const problems = [];
    if (e.verdict !== s[key]) problems.push(`verdict ${e.verdict} != ${s[key]}`);
    if (e.verdict === 'broken') {
      const located = (e.evidence ?? []).some((ev) => ev.callSite || ev.location || ev.kind === 'cookie');
      if (!located) problems.push('broken without a call site or location');
    }
    return { section: s.section, ok: problems.length === 0, note: problems.join('; ') || e.verdict };
  });
}

export function printRows(title, rows) {
  process.stdout.write(`\n${title}\n`);
  for (const r of rows) process.stdout.write(`  ${r.ok ? 'PASS' : 'FAIL'}  §${r.section.padEnd(4)} ${r.note}\n`);
  const failed = rows.filter((r) => !r.ok).length;
  process.stdout.write(`  ${rows.length - failed}/${rows.length} passed\n`);
  return failed === 0;
}
