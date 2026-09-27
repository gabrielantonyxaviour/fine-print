import { describe, it, expect } from 'vitest';
import { createCanary, canaryFields } from '../src/canary/factory.ts';
import { canaryVariants } from '../src/canary/variants.ts';

describe('createCanary', () => {
  it('returns all required fields', () => {
    const c = createCanary('abc123');
    expect(c.runId).toBe('abc123');
    expect(c.name).toBeTruthy();
    expect(c.email).toBeTruthy();
    expect(c.phone).toBeTruthy();
    expect(c.pw).toBeTruthy();
    expect(c.ip).toBeTruthy();
    expect(c.healthReason).toBeTruthy();
    expect(c.card.number).toBe('4242424242424242');
    expect(c.card.expMonth).toBe(12);
    expect(c.card.expYear).toBe(2034);
    expect(c.card.cvc).toBe('123');
  });

  it('uses runId in derived fields', () => {
    const c = createCanary('xyz789');
    expect(c.email).toContain('xyz789');
    expect(c.pw).toBe('Harbour-xyz789-Lantern!');
    expect(c.healthReason).toContain('xyz789');
  });

  it('email is lowercase', () => {
    const c = createCanary('abc123');
    expect(c.email).toBe(c.email.toLowerCase());
  });

  it('phone is E.164 UK drama range', () => {
    const c = createCanary('abc123');
    expect(c.phone).toMatch(/^\+447700900\d{3}$/);
  });

  it('ip is in the 203.0.113.0/24 test range', () => {
    const c = createCanary('abc123');
    expect(c.ip).toMatch(/^203\.0\.113\.(1\d{2}|2[0-4]\d|25[0-4]|[1-9]\d|[1-9])$/);
  });

  it('fields are unique per runId', () => {
    const c1 = createCanary('aaa111');
    const c2 = createCanary('bbb222');
    // At least some fields will differ
    const same = c1.email === c2.email && c1.pw === c2.pw;
    expect(same).toBe(false);
  });

  it('canaryFields returns all expected field names', () => {
    const c = createCanary('test01');
    const fields = canaryFields(c);
    const names = fields.map((f) => f.field);
    expect(names).toContain('name');
    expect(names).toContain('email');
    expect(names).toContain('phone');
    expect(names).toContain('pw');
    expect(names).toContain('ip');
    expect(names).toContain('healthReason');
    expect(names).toContain('card.number');
  });
});

describe('canaryVariants', () => {
  it('includes raw, base64, sha256 forms for email', () => {
    const c = createCanary('abc123');
    const emailVars = canaryVariants('email', c.email);
    const forms = emailVars.map((v) => v.form);
    expect(forms).toContain('raw');
    expect(forms).toContain('base64');
    expect(forms).toContain('sha256');
  });

  it('includes lower form for mixed-case values', () => {
    // name has mixed case (e.g. "Priya Raman") so raw != lower
    const c = createCanary('abc123');
    const nameVars = canaryVariants('name', c.name);
    const forms = nameVars.map((v) => v.form);
    expect(forms).toContain('raw');
    expect(forms).toContain('lower');
  });

  it('no variant is shorter than 8 characters', () => {
    const c = createCanary('abc123');
    for (const { field, value } of canaryFields(c)) {
      const variants = canaryVariants(field, value);
      for (const v of variants) {
        expect(v.text.length).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('phone includes digits, national, spaced, sha256_digits forms', () => {
    const c = createCanary('abc123');
    const phoneVars = canaryVariants('phone', c.phone);
    const forms = phoneVars.map((v) => v.form);
    // e164 may be deduped with raw since they are the same value
    expect(forms).toContain('digits');
    expect(forms).toContain('national');
    expect(forms).toContain('spaced');
    expect(forms).toContain('sha256_digits');
  });

  it('phone national form starts with 0', () => {
    const c = createCanary('abc123');
    const phoneVars = canaryVariants('phone', c.phone);
    const national = phoneVars.find((v) => v.form === 'national');
    expect(national?.text).toMatch(/^0\d+/);
  });

  it('phone digits form strips leading +', () => {
    const c = createCanary('abc123');
    const phoneVars = canaryVariants('phone', c.phone);
    const digits = phoneVars.find((v) => v.form === 'digits');
    expect(digits?.text).toMatch(/^\d+$/);
  });

  it('no duplicate text values', () => {
    const c = createCanary('abc123');
    for (const { field, value } of canaryFields(c)) {
      const variants = canaryVariants(field, value);
      const texts = variants.map((v) => v.text);
      const unique = new Set(texts);
      expect(unique.size).toBe(texts.length);
    }
  });
});
