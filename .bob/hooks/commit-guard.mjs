#!/usr/bin/env node
// commit-guard.mjs - PreToolUse hook for execute_command
// Blocks git commit if fineprint guard fails.

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

  const command =
    (payload.tool_input && payload.tool_input.command) ||
    (payload.input && payload.input.command) ||
    '';

  if (!/\bgit\s+commit\b/.test(command)) {
    process.exit(0);
  }

  try {
    execSync('pnpm --silent fineprint guard', { stdio: 'pipe' });
    process.exit(0);
  } catch (err) {
    const detail = (err.stderr || err.stdout || '').toString().trim();
    process.stderr.write(
      (detail ? detail + '\n' : '') +
      'Blocked by Fine Print: this commit breaks a privacy promise.\n'
    );
    process.exit(2);
  }
});
