import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /live/<target>/ledger.json and /live/<target>/policy.md read straight from
// examples/<target>, so the page updates while `fineprint prove` is running.
function liveTargets(): Plugin {
  const examples = resolve(__dirname, '../../examples');
  return {
    name: 'fineprint-live',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/live\/([a-z0-9-]+)\/(ledger\.json|policy\.md)/.exec(req.url ?? '');
        if (!m) return next();
        const file = m[2] === 'policy.md' ? resolve(examples, m[1]!, 'PRIVACY.md') : resolve(examples, m[1]!, 'fineprint', 'ledger.json');
        if (!existsSync(file)) { res.statusCode = 404; res.end('not found'); return; }
        res.setHeader('cache-control', 'no-store');
        res.end(readFileSync(file));
      });
    },
  };
}

export default defineConfig({ plugins: [react(), liveTargets()] });
