import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['proofs/**/*.proof.test.ts'] } });
