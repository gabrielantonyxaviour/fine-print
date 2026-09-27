import { describe, it, expect } from 'vitest';
import { PromiseFileSchema, parseOrExplain } from '../src/schema.ts';

const validPolicy = {
  title: 'Test Privacy Policy',
  sourcePath: 'examples/policy.html',
  sha256: 'a'.repeat(64),
};

const validPromise = {
  id: 'p-4-2-email-no-ads',
  section: '4.2',
  quote: 'We never share your email address with advertisers.',
  category: 'sharing',
  dataClasses: ['email'],
  claim: { kind: 'egress_never_to', data: ['email'], forbiddenDestinations: ['advertisers'] },
  testability: 'testable',
  rationale: 'Explicit promise in section 4.2',
};

describe('PromiseFile schema', () => {
  it('parses a valid PromiseFile', () => {
    const result = PromiseFileSchema.safeParse({
      policy: validPolicy,
      promises: [validPromise],
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing quote', () => {
    const bad = { ...validPromise, quote: undefined };
    expect(() =>
      parseOrExplain(PromiseFileSchema, { policy: validPolicy, promises: [bad] }, 'promises.json'),
    ).toThrow(/promises\.json: promises\[0\]\.quote/);
  });

  it('rejects unknown category', () => {
    const bad = { ...validPromise, category: 'not_a_category' };
    expect(() =>
      parseOrExplain(PromiseFileSchema, { policy: validPolicy, promises: [bad] }, 'promises.json'),
    ).toThrow(/promises\.json: promises\[0\]\.category/);
  });

  it('rejects empty section', () => {
    const bad = { ...validPromise, section: '' };
    expect(() =>
      parseOrExplain(PromiseFileSchema, { policy: validPolicy, promises: [bad] }, 'promises.json'),
    ).toThrow(/promises\.json: promises\[0\]\.section/);
  });

  it('rejects duplicate promise ids', () => {
    expect(() =>
      parseOrExplain(
        PromiseFileSchema,
        { policy: validPolicy, promises: [validPromise, validPromise] },
        'promises.json',
      ),
    ).toThrow(/promises\.json:/);
  });

  it('rejects bad id pattern', () => {
    const bad = { ...validPromise, id: 'not-valid-id' };
    expect(() =>
      parseOrExplain(PromiseFileSchema, { policy: validPolicy, promises: [bad] }, 'promises.json'),
    ).toThrow(/promises\.json: promises\[0\]\.id/);
  });
});
