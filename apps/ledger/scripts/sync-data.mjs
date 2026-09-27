// Copies a target's policy and ledger into public/data/<target>/ for a static build.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = process.argv[2] ?? 'tidewell';
const src = join(root, '..', '..', 'examples', target);
const out = join(root, 'public', 'data', target);
mkdirSync(out, { recursive: true });
copyFileSync(join(src, 'PRIVACY.md'), join(out, 'policy.md'));
const ledger = join(src, 'fineprint', 'ledger.json');
if (existsSync(ledger)) copyFileSync(ledger, join(out, 'ledger.json'));
process.stdout.write(`synced ${target}${existsSync(ledger) ? '' : ' (no ledger yet)'}\n`);
