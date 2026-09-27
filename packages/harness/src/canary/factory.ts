import type { Matched } from '@fineprint/core';

const NAMES = [
  ['Priya', 'Raman'],
  ['Tomasz', 'Nowak'],
  ['Amara', 'Diallo'],
  ['Chen', 'Wei'],
  ['Sofia', 'Herrera'],
  ['Kofi', 'Mensah'],
  ['Ingrid', 'Larsen'],
  ['Ryo', 'Tanaka'],
] as const;

export interface Canary {
  runId: string;
  name: string;
  email: string;
  phone: string;
  pw: string;
  ip: string;
  healthReason: string;
  card: { number: string; expMonth: number; expYear: number; cvc: string };
}

function runIdToIndex(runId: string, max: number): number {
  let h = 0;
  for (let i = 0; i < runId.length; i++) {
    h = (h * 31 + runId.charCodeAt(i)) >>> 0;
  }
  return h % max;
}

function randomAlnum(len: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export function createCanary(runId?: string): Canary {
  const id = runId ?? randomAlnum(6);
  const pair = NAMES[runIdToIndex(id, NAMES.length)]!;
  const [first, last] = pair;
  const name = `${first} ${last}`;
  const email = `${first.toLowerCase()}.${last.toLowerCase()}.${id}@example.com`;

  const nnn = runIdToIndex(id, 1000);
  const phone = `+447700900${String(nnn).padStart(3, '0')}`;

  const pw = `Harbour-${id}-Lantern!`;

  const n = (runIdToIndex(id, 254) + 1) as number;
  const ip = `203.0.113.${n}`;

  const healthReason = `Knee pain after running (${id})`;

  const card = { number: '4242424242424242', expMonth: 12, expYear: 2034, cvc: '123' };

  return { runId: id, name, email, phone, pw, ip, healthReason, card };
}

export function canaryFields(c: Canary): { field: string; value: string }[] {
  return [
    { field: 'name', value: c.name },
    { field: 'email', value: c.email },
    { field: 'phone', value: c.phone },
    { field: 'pw', value: c.pw },
    { field: 'ip', value: c.ip },
    { field: 'healthReason', value: c.healthReason },
    { field: 'card.number', value: c.card.number },
  ];
}
