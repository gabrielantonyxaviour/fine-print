// Grades Fine Print's audit of Tidewell against GROUND_TRUTH.json.
//   node compare-ground-truth.mjs --stage extract
//   node compare-ground-truth.mjs --stage audit|fix [ledger.json]
//   node compare-ground-truth.mjs --self-test
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { TIDEWELL, gradeExtract, gradeLedger, groundTruth, printRows, readJson } from './grading.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };

function selfTest() {
  const gt = groundTruth();
  const promises = gt.map((s) => ({
    id: s.promiseId, section: s.section, quote: `${s.quote}`, category: s.expectedCategory,
    testability: s.expectedCategory === 'human_review' ? 'human_review' : 'testable',
  }));
  promises.push({ id: 'p-8-rights', section: '8', quote: 'you can ask us to erase it', category: 'human_review', testability: 'human_review' });
  const before = gt.map((s) => ({ quote: s.quote, verdict: s.expectedVerdictBefore, evidence: [{ kind: 'egress', callSite: 'src/x.ts:1' }] }));
  const checks = [
    ['extract matches', gradeExtract(promises).every((r) => r.ok)],
    ['extra testable promise fails', !gradeExtract([...promises, { id: 'p-9', section: '9', quote: 'x', testability: 'testable' }]).every((r) => r.ok)],
    ['audit matches', gradeLedger(before, 'audit').every((r) => r.ok)],
    ['wrong verdict fails', !gradeLedger(before.map((e) => ({ ...e, verdict: 'kept' })), 'audit').every((r) => r.ok)],
    ['curly quotes and spacing normalise', gradeExtract(promises.map((p) => ({ ...p, quote: p.quote.replace(/'/g, '’').replace(/ /g, '  ') }))).every((r) => r.ok)],
  ];
  for (const [name, ok] of checks) process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}\n`);
  return checks.every(([, ok]) => ok);
}

let ok;
if (args.includes('--self-test')) ok = selfTest();
else {
  const stage = flag('--stage');
  if (stage === 'extract') {
    const file = join(TIDEWELL, 'fineprint', 'promises.json');
    if (!existsSync(file)) { process.stderr.write('No fineprint/promises.json yet: run the Fine Print audit first.\n'); process.exit(1); }
    ok = printRows('Extraction vs ground truth', gradeExtract(readJson(file).promises));
  } else if (stage === 'audit' || stage === 'fix') {
    const file = args.find((a) => a.endsWith('.json')) ?? join(TIDEWELL, 'fineprint', 'ledger.json');
    if (!existsSync(file)) { process.stderr.write(`No ledger at ${file}: run fineprint prove first.\n`); process.exit(1); }
    ok = printRows(`Verdicts vs ground truth (${stage})`, gradeLedger(readJson(file).entries, stage));
  } else {
    process.stderr.write('Usage: --stage extract|audit|fix [ledger.json] | --self-test\n');
    process.exit(2);
  }
}
process.exit(ok ? 0 : 1);
