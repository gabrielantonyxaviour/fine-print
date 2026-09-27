import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { PromiseFileSchema, StoresFileSchema, TraceSchema, LedgerSchema } from './schema.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'schema');
mkdirSync(outDir, { recursive: true });

const schemas: [string, z.ZodType][] = [
  ['promises.schema.json', PromiseFileSchema],
  ['stores.schema.json', StoresFileSchema],
  ['trace.schema.json', TraceSchema],
  ['ledger.schema.json', LedgerSchema],
];

for (const [filename, schema] of schemas) {
  const jsonSchema = z.toJSONSchema(schema);
  writeFileSync(join(outDir, filename), JSON.stringify(jsonSchema, null, 2) + '\n');
}

process.stdout.write(`Wrote ${schemas.length} JSON Schema files to packages/core/schema/\n`);
