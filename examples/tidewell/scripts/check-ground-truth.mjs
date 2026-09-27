// Consistency check for Tidewell's answer key: quotes, patches and the policy PDF.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, TIDEWELL, groundTruth } from './grading.mjs';

const problems = [];
const statements = groundTruth();
const policy = readFileSync(join(TIDEWELL, 'PRIVACY.md'), 'utf8');

if (statements.length !== 10) problems.push(`expected 10 statements, found ${statements.length}`);
for (const s of statements) {
  if (!policy.includes(s.quote)) problems.push(`§${s.section} quote not verbatim in PRIVACY.md`);
  if (s.expectedVerdictBefore === 'kept' && !s.mutationPatch) problems.push(`§${s.section} is kept but has no mutation patch`);
  if (s.mutationPatch) {
    try { execFileSync('git', ['apply', '--check', s.mutationPatch], { cwd: REPO, stdio: 'pipe' }); }
    catch { problems.push(`§${s.section} patch does not apply: ${s.mutationPatch}`); }
  }
}
const pdf = join(TIDEWELL, 'privacy-policy.pdf');
if (!existsSync(pdf)) problems.push('privacy-policy.pdf missing (run scripts/render-policy-pdf.mjs)');
else if (statSync(pdf).mtimeMs < statSync(join(TIDEWELL, 'PRIVACY.md')).mtimeMs) problems.push('privacy-policy.pdf is older than PRIVACY.md');

if (problems.length) { for (const p of problems) process.stderr.write(`FAIL  ${p}\n`); process.exit(1); }
process.stdout.write(`PASS  ${statements.length} statements, patches apply, PDF current\n`);
