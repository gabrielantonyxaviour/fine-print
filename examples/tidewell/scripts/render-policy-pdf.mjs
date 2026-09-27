// Renders PRIVACY.md to privacy-policy.pdf with a headless Chromium browser.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const md = readFileSync(join(root, 'PRIVACY.md'), 'utf8');
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
let html = '', inList = false;
for (const line of md.split('\n')) {
  const t = line.trim();
  if (t.startsWith('- ')) { if (!inList) { html += '<ul>'; inList = true; } html += `<li>${esc(t.slice(2))}</li>`; continue; }
  if (inList) { html += '</ul>'; inList = false; }
  if (t.startsWith('### ')) html += `<h3>${esc(t.slice(4))}</h3>`;
  else if (t.startsWith('## ')) html += `<h2>${esc(t.slice(3))}</h2>`;
  else if (t.startsWith('# ')) html += `<h1>${esc(t.slice(2))}</h1>`;
  else if (t) html += `<p>${esc(t)}</p>`;
}
if (inList) html += '</ul>';
const page = `<!doctype html><meta charset="utf-8"><style>
body{font:11pt/1.5 Georgia,serif;color:#1d2330;margin:48px 64px}h1{font:600 22pt Helvetica,Arial,sans-serif;color:#0b5c6b}
h2{font:600 14pt Helvetica,Arial,sans-serif;margin-top:22px;color:#0b5c6b}h3{font:600 11.5pt Helvetica,Arial,sans-serif;margin:14px 0 4px}
p{margin:6px 0}</style>${html}`;
const dir = mkdtempSync(join(tmpdir(), 'tidewell-pdf-'));
const htmlFile = join(dir, 'privacy.html');
writeFileSync(htmlFile, page);
const home = process.env.HOME ?? '';
const cache = join(home, 'Library/Caches/ms-playwright');
const shells = existsSync(cache)
  ? readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell-')).sort().reverse()
      .map((d) => join(cache, d, 'chrome-headless-shell-mac-arm64', 'chrome-headless-shell'))
  : [];
const browser = [...shells, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((b) => existsSync(b));
if (!browser) throw new Error('No Chromium browser found to print the PDF');
const out = join(root, 'privacy-policy.pdf');
execFileSync(browser, ['--disable-gpu', '--no-pdf-header-footer', `--user-data-dir=${join(dir, 'profile')}`, `--print-to-pdf=${out}`, `file://${htmlFile}`], { stdio: 'ignore', timeout: 60000 });
process.stdout.write(`wrote ${out}\n`);
