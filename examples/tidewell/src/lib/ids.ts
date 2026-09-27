import { randomBytes, randomInt } from 'node:crypto';

// Prefixed IDs make rows easy to recognise in logs and support tickets.
export function newId(prefix: 'usr' | 'apt' | 'pay'): string {
  return `${prefix}_${randomBytes(9).toString('base64url')}`;
}

export function newSessionId(): string {
  return randomBytes(32).toString('base64url');
}

export function newVerificationCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
