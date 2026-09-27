// Proves every "kept" proof can fail: applies each mutation patch in place, reruns the proofs,
// and checks that exactly that promise flips to broken. Always reverts the patch.
import { execFileSync, spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, TIDEWELL, findMatch, groundTruth } from './grading.mjs';

function prove() {
  const out = spawnSync('pnpm', ['--silent', 'fineprint', 'prove', 'examples/tidewell', '--json'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (out.error || !out.stdout.trim().startsWith('{')) {
    throw new Error(`fineprint CLI not found or failed: ${(out.stderr || String(out.error)).slice(0, 400)}`);
  }
  return JSON.parse(out.stdout).entries;
}

const clean = spawnSync('git', ['diff', '--quiet', '--', 'examples/tidewell/src'], { cwd: REPO });
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', 'examples/tidewell/src'], { cwd: REPO, encoding: 'utf8' });
if (clean.status !== 0) { process.stderr.write('examples/tidewell/src has local edits; commit or stash them first.\n'); process.exit(2); }

const statements = groundTruth();
const verdicts = (entries) => Object.fromEntries(statements.map((s) => [s.section, findMatch(entries, s)?.verdict ?? 'missing']));
const baseline = verdicts(prove());
const results = [];

for (const s of statements.filter((x) => x.mutationPatch)) {
  execFileSync('git', ['apply', s.mutationPatch], { cwd: REPO });
  let after;
  try { after = verdicts(prove()); }
  finally { execFileSync('git', ['apply', '-R', s.mutationPatch], { cwd: REPO }); }
  const flipped = Object.keys(after).filter((k) => after[k] !== baseline[k]);
  const ok = after[s.section] === 'broken' && flipped.length === 1 && flipped[0] === s.section;
  results.push({ section: s.section, patch: s.mutationPatch, ok, flipped, verdict: after[s.section] });
  process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  §${s.section.padEnd(4)} ${s.mutationPatch.split('/').pop()}  -> ${after[s.section]}${flipped.length > 1 ? ` (also flipped: ${flipped.filter((k) => k !== s.section).join(', ')})` : ''}\n`);
}

writeFileSync(join(TIDEWELL, '.mutation-check.json'), JSON.stringify({ at: new Date().toISOString(), baseline, results, untrackedAtStart: untracked.split('\n').filter(Boolean) }, null, 2));
const passed = results.filter((r) => r.ok).length;
process.stdout.write(`${passed}/${results.length} kept proofs fail when their promise is broken\n`);
process.exit(passed === results.length ? 0 : 1);
