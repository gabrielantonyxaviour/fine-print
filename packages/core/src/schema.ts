import { z } from 'zod';

// ── Primitives ────────────────────────────────────────────────────────────────

export const CategorySchema = z.enum([
  'sharing',
  'purpose_limitation',
  'retention_deletion',
  'collection_minimization',
  'security_storage',
  'consent_gate',
  'cookies_tracking',
  'residency',
  'human_review',
]);
export type Category = z.infer<typeof CategorySchema>;

export const TestabilitySchema = z.enum(['testable', 'partial', 'human_review']);
export type Testability = z.infer<typeof TestabilitySchema>;

export const VerdictSchema = z.enum(['kept', 'broken', 'needs_review', 'couldnt_check', 'pending']);
export type Verdict = z.infer<typeof VerdictSchema>;

// ── Claim ─────────────────────────────────────────────────────────────────────

export const ClaimSchema = z.object({
  kind: z.enum([
    'egress_only_to',
    'egress_never_to',
    'no_residue_after',
    'never_stored',
    'consent_required',
    'cookies_only',
    'region_only',
    'none',
  ]),
  data: z.array(z.string()),
  allowedDestinations: z.array(z.string()).optional(),
  forbiddenDestinations: z.array(z.string()).optional(),
  withinDays: z.int().min(0).optional(),
  condition: z.string().optional(),
});
export type Claim = z.infer<typeof ClaimSchema>;

// ── PromiseItem ───────────────────────────────────────────────────────────────

const promiseIdPattern = /^p-\d+(-\d+)*-[a-z0-9-]+$/;

export const PromiseItemSchema = z.object({
  id: z.string().regex(promiseIdPattern),
  section: z.string().min(1),
  quote: z.string().min(10),
  category: CategorySchema,
  dataClasses: z.array(z.string()),
  claim: ClaimSchema,
  testability: TestabilitySchema,
  rationale: z.string().min(1),
});
export type PromiseItem = z.infer<typeof PromiseItemSchema>;

// ── PolicyRef ─────────────────────────────────────────────────────────────────

export const PolicyRefSchema = z.object({
  title: z.string(),
  effectiveDate: z.string().optional(),
  sourcePath: z.string(),
  pdfPath: z.string().optional(),
  sha256: z.string().length(64).regex(/^[0-9a-f]{64}$/),
});
export type PolicyRef = z.infer<typeof PolicyRefSchema>;

// ── PromiseFile ───────────────────────────────────────────────────────────────

export const PromiseFileSchema = z
  .object({
    policy: PolicyRefSchema,
    promises: z.array(PromiseItemSchema),
  })
  .refine(
    (f) => {
      const ids = f.promises.map((p) => p.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'promise ids must be unique', path: ['promises'] },
  );
export type PromiseFile = z.infer<typeof PromiseFileSchema>;

// ── DataStore / StoresFile ────────────────────────────────────────────────────

export const DataStoreSchema = z.object({
  id: z.string(),
  kind: z.enum(['sqlite', 'sqlite-table', 'json-file', 'file-glob', 'dir', 'postgres', 'http-dump']),
  location: z.string(),
  table: z.string().optional(),
  notes: z.string().optional(),
});
export type DataStore = z.infer<typeof DataStoreSchema>;

export const StoresFileSchema = z
  .object({
    stores: z.array(DataStoreSchema),
  })
  .refine(
    (f) => {
      const ids = f.stores.map((s) => s.id);
      return new Set(ids).size === ids.length;
    },
    { message: 'store ids must be unique', path: ['stores'] },
  );
export type StoresFile = z.infer<typeof StoresFileSchema>;

// ── Trace ─────────────────────────────────────────────────────────────────────

export const TraceSchema = z.object({
  promiseId: z.string(),
  dataFlow: z.array(
    z.object({
      step: z.string(),
      file: z.string(),
      line: z.int().optional(),
      symbol: z.string().optional(),
    }),
  ),
  sinks: z.array(z.string()),
  journeys: z.array(z.string()),
  confidence: z.enum(['high', 'medium', 'low']),
  openQuestions: z.array(z.string()),
});
export type Trace = z.infer<typeof TraceSchema>;

// ── Evidence ──────────────────────────────────────────────────────────────────

export const MatchedSchema = z.object({
  field: z.string(),
  form: z.string(),
});
export type Matched = z.infer<typeof MatchedSchema>;

export const EvidenceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('egress'),
    method: z.string(),
    host: z.string(),
    path: z.string(),
    matched: MatchedSchema,
    callSite: z.string().optional(),
  }),
  z.object({
    kind: z.literal('residue'),
    storeId: z.string(),
    location: z.string(),
    matched: MatchedSchema,
  }),
  z.object({
    kind: z.literal('cookie'),
    name: z.string(),
    attributes: z.string(),
  }),
  z.object({
    kind: z.literal('note'),
    text: z.string(),
  }),
]);
export type Evidence = z.infer<typeof EvidenceSchema>;

// ── LedgerEntry / RunMeta / Ledger ────────────────────────────────────────────

export const LedgerEntrySchema = z.object({
  promiseId: z.string(),
  section: z.string(),
  quote: z.string(),
  category: CategorySchema,
  verdict: VerdictSchema,
  reason: z.string(),
  evidence: z.array(EvidenceSchema),
  proofPath: z.string().optional(),
  tracePath: z.string().optional(),
  durationMs: z.number().optional(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const RunMetaSchema = z.object({
  id: z.string(),
  startedAt: z.string(),
  durationMs: z.number(),
  commit: z.string().optional(),
  harnessVersion: z.string(),
  promiseCount: z.number(),
  counts: z.record(VerdictSchema, z.number()),
});
export type RunMeta = z.infer<typeof RunMetaSchema>;

export const LedgerSchema = z.object({
  policy: PolicyRefSchema,
  run: RunMetaSchema,
  entries: z.array(LedgerEntrySchema),
});
export type Ledger = z.infer<typeof LedgerSchema>;

// ── GroundTruth / EvalResults ─────────────────────────────────────────────────

export const GroundTruthSchema = z.object({
  statements: z.array(
    z.object({
      promiseId: z.string(),
      section: z.string(),
      quote: z.string(),
      expectedCategory: CategorySchema,
      expectedVerdictBefore: VerdictSchema,
      expectedVerdictAfterFix: VerdictSchema,
      mutationPatch: z.string().optional(),
    }),
  ),
});
export type GroundTruth = z.infer<typeof GroundTruthSchema>;

export const EvalResultsSchema = z.object({
  target: z.object({
    repo: z.string(),
    commit: z.string(),
  }),
  baseline: z.object({
    ledgerPath: z.string(),
    falseAlarms: z.int(),
  }),
  mutants: z.array(
    z.object({
      id: z.string(),
      description: z.string(),
      patchPath: z.string(),
      targetsPromise: z.string(),
      caught: z.boolean(),
      caughtBy: z.string().optional(),
      logPath: z.string(),
    }),
  ),
});
export type EvalResults = z.infer<typeof EvalResultsSchema>;

// ── Utility ───────────────────────────────────────────────────────────────────

export function parseOrExplain<T>(schema: z.ZodType<T>, data: unknown, label: string): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const issue = result.error.issues[0];
  if (!issue) throw new Error(`${label}: validation failed`);
  const path = issue.path.reduce<string>((acc, segment, i) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    return i === 0 ? String(segment) : `${acc}.${String(segment)}`;
  }, '');
  const displayPath = path.length > 0 ? path : '(root)';
  throw new Error(`${label}: ${displayPath}: ${issue.message}`);
}
