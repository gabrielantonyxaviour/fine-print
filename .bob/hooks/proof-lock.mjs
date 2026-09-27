#!/usr/bin/env node
// proof-lock.mjs - PreToolUse hook for write_file / apply_diff / insert_content / search_and_replace
// Blocks edits to fineprint/proofs/ once the audit baseline tag exists.

import { execSync } from 'node:child_process';

const chunks = [];
process.stdin.on('data', (d) => chunks.push(d));
process.stdin.on('end', () => {
  let payload;
  try {
    payload = JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    process.exit(0);
  }

  const path =
    (payload.tool_input && payload.tool_input.path) ||
    (payload.input && payload.input.path) ||
    '';

  if (!path.includes('fineprint/proofs/')) {
    process.exit(0);
  }

  try {
    execSync('git rev-parse -q --verify refs/tags/fineprint-audit-baseline', { stdio: 'pipe' });
  } catch {
    // Tag does not exist - allow the edit.
    process.exit(0);
  }

  process.stderr.write(
    'Blocked by Fine Print: proofs are frozen after the audit. Fix the code, not the test.\n'
  );
  process.exit(2);
});
