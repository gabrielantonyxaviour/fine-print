#!/usr/bin/env node
// check-bob-pack.mjs - verifies the Fine Print Bob pack is correctly structured.

import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

let pass = 0;
let fail = 0;

function ok(label) {
  console.log('  PASS  ' + label);
  pass++;
}

function ko(label, detail) {
  console.log('  FAIL  ' + label + (detail ? ' -- ' + detail : ''));
  fail++;
}

function check(label, cond, detail) {
  if (cond) ok(label); else ko(label, detail);
}

// ---------------------------------------------------------------------------
// Tiny YAML parser: extracts customModes slugs and their edit fileRegex values.
// Handles the specific structure used in custom_modes.yaml.
// ---------------------------------------------------------------------------
function parseModesYaml(text) {
  const modes = [];
  // Split on top-level slug: lines to find each mode block.
  const slugMatches = [...text.matchAll(/^\s{2}-\s+slug:\s+(\S+)/gm)];
  for (const m of slugMatches) {
    modes.push({ slug: m[1], fileRegex: [] });
  }
  // Extract fileRegex values.
  const regexMatches = [...text.matchAll(/fileRegex:\s+"([^"]+)"/g)];
  // Associate: regexes appear in order of modes. Each mode has at most one fileRegex in this file.
  for (let i = 0; i < regexMatches.length; i++) {
    if (modes[i]) modes[i].fileRegex = regexMatches[i][1];
  }
  return modes;
}

// ---------------------------------------------------------------------------
// 1. custom_modes.yaml: both modes exist
// ---------------------------------------------------------------------------
console.log('\n--- custom_modes.yaml ---');
const modesPath = path.join(root, '.bob/custom_modes.yaml');
check('custom_modes.yaml exists', existsSync(modesPath));

let modes = [];
if (existsSync(modesPath)) {
  const modesText = readFileSync(modesPath, 'utf8');
  modes = parseModesYaml(modesText);
  const slugs = modes.map((m) => m.slug);
  check('fp-auditor mode exists', slugs.includes('fp-auditor'));
  check('fp-engineer mode exists', slugs.includes('fp-engineer'));

  // ---------------------------------------------------------------------------
  // 2. fileRegex checks
  // ---------------------------------------------------------------------------
  console.log('\n--- fileRegex checks ---');
  const auditor = modes.find((m) => m.slug === 'fp-auditor');
  const engineer = modes.find((m) => m.slug === 'fp-engineer');

  if (auditor && auditor.fileRegex) {
    const re = new RegExp(auditor.fileRegex);
    check(
      'auditor fileRegex matches examples/tidewell/fineprint/promises.json',
      re.test('examples/tidewell/fineprint/promises.json')
    );
    check(
      'auditor fileRegex does NOT match examples/tidewell/src/app.ts',
      !re.test('examples/tidewell/src/app.ts')
    );
  } else {
    ko('auditor fileRegex present', 'not found');
    ko('auditor fileRegex does NOT match examples/tidewell/src/app.ts', 'not found');
  }

  if (engineer && engineer.fileRegex) {
    const re = new RegExp(engineer.fileRegex);
    check(
      'engineer fileRegex matches examples/tidewell/src/app.ts',
      re.test('examples/tidewell/src/app.ts')
    );
    check(
      'engineer fileRegex does NOT match examples/tidewell/fineprint/proofs/p-1.proof.test.ts',
      !re.test('examples/tidewell/fineprint/proofs/p-1.proof.test.ts')
    );
  } else {
    ko('engineer fileRegex present', 'not found');
    ko('engineer fileRegex does NOT match proof path', 'not found');
  }
}

// ---------------------------------------------------------------------------
// 3. Skills: all four have name and description in frontmatter
// ---------------------------------------------------------------------------
console.log('\n--- skills ---');
const skills = ['fp-audit', 'fp-trace-promise', 'fp-fix', 'fp-guard'];
for (const skill of skills) {
  const skillPath = path.join(root, '.bob/skills', skill, 'SKILL.md');
  check(skill + '/SKILL.md exists', existsSync(skillPath));
  if (existsSync(skillPath)) {
    const text = readFileSync(skillPath, 'utf8');
    check(skill + ' has name in frontmatter', /^name:\s+\S+/m.test(text));
    check(skill + ' has description in frontmatter', /^description:\s+\S/m.test(text));
  }
}

// ---------------------------------------------------------------------------
// 4. Personas: both exist
// ---------------------------------------------------------------------------
console.log('\n--- personas ---');
const personas = ['fp-tracer', 'fp-fixer'];
for (const persona of personas) {
  const pPath = path.join(root, '.bob/agents', persona + '.md');
  check(persona + '.md exists', existsSync(pPath));
  if (existsSync(pPath)) {
    const text = readFileSync(pPath, 'utf8');
    check(persona + ' has name in frontmatter', new RegExp('^name:\\s+' + persona, 'm').test(text));
  }
}

// ---------------------------------------------------------------------------
// 5. settings.json parses and has hooks
// ---------------------------------------------------------------------------
console.log('\n--- settings.json ---');
const settingsPath = path.join(root, '.bob/settings.json');
check('settings.json exists', existsSync(settingsPath));
if (existsSync(settingsPath)) {
  let settings;
  try {
    settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    ok('settings.json parses as valid JSON');
  } catch (e) {
    ko('settings.json parses as valid JSON', e.message);
    settings = null;
  }
  if (settings) {
    check('settings.json has hooks.PreToolUse array', Array.isArray(settings?.hooks?.PreToolUse));
  }
}

// ---------------------------------------------------------------------------
// 6. Hook tests
// ---------------------------------------------------------------------------
console.log('\n--- hook tests ---');

// proof-lock: proof path with no tag -> should exit 0
try {
  const proofPayload = JSON.stringify({
    tool_input: { path: 'examples/tidewell/fineprint/proofs/x.proof.test.ts' },
  });
  execSync(`echo '${proofPayload}' | node .bob/hooks/proof-lock.mjs`, {
    cwd: root,
    stdio: 'pipe',
  });
  ok('proof-lock exits 0 for proof path when no baseline tag');
} catch (e) {
  if (e.status === 0) {
    ok('proof-lock exits 0 for proof path when no baseline tag');
  } else {
    ko('proof-lock exits 0 for proof path when no baseline tag', 'exit ' + e.status);
  }
}

// proof-lock: non-proof path -> exit 0
try {
  const nonProofPayload = JSON.stringify({ tool_input: { path: 'examples/tidewell/src/app.ts' } });
  execSync(`echo '${nonProofPayload}' | node .bob/hooks/proof-lock.mjs`, {
    cwd: root,
    stdio: 'pipe',
  });
  ok('proof-lock exits 0 for non-proof path');
} catch (e) {
  ko('proof-lock exits 0 for non-proof path', 'exit ' + (e.status || '?'));
}

// commit-guard: non-commit command -> exit 0
try {
  const lsPayload = JSON.stringify({ tool_input: { command: 'ls' } });
  execSync(`echo '${lsPayload}' | node .bob/hooks/commit-guard.mjs`, {
    cwd: root,
    stdio: 'pipe',
  });
  ok('commit-guard exits 0 for non-commit command');
} catch (e) {
  ko('commit-guard exits 0 for non-commit command', 'exit ' + (e.status || '?'));
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log('\n--- summary ---');
console.log('Passed: ' + pass + '  Failed: ' + fail);
if (fail > 0) {
  process.exit(1);
}
