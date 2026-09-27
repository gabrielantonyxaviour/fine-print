import { AsyncLocalStorage } from 'node:async_hooks';
import http from 'node:http';
import https from 'node:https';
import { BatchInterceptor } from '@mswjs/interceptors';
import { ClientRequestInterceptor } from '@mswjs/interceptors/ClientRequest';
import { FetchInterceptor } from '@mswjs/interceptors/fetch';
import type { Matched } from '@fineprint/core';
import { callSiteFrom } from './callsite.ts';
import { findCanaries } from '../canary/match.ts';

const MAX_BODY = 64 * 1024;

export interface EgressRecord {
  method: string;
  url: string;
  host: string;
  path: string;
  headers: Record<string, string>;
  body: string;
  callSite: string | undefined;
}

export interface EgressRecorder {
  requests: EgressRecord[];
  stop(): void;
  clear(): void;
}

export interface EgressRecorderOptions {
  targetRoot: string;
  respond?: (record: EgressRecord) => Response;
}

const als = new AsyncLocalStorage<string>();

export function startEgressRecorder(opts: EgressRecorderOptions): EgressRecorder {
  const requests: EgressRecord[] = [];

  function captureStack(): string {
    return new Error().stack ?? '';
  }

  // ── Wrap globals to capture stacks synchronously ─────────────────────────
  // Use default imports (same object as CJS require) so mutations are visible
  // to all callers that also use the default import or require().
  const origFetch = globalThis.fetch;
  const origHttpRequest = http.request.bind(http);
  const origHttpGet = http.get.bind(http);
  const origHttpsRequest = https.request.bind(https);
  const origHttpsGet = https.get.bind(https);

  // @ts-ignore – assignment to globalThis.fetch
  globalThis.fetch = function (this: unknown, ...args: Parameters<typeof fetch>) {
    const stack = captureStack();
    const self = this;
    return als.run(stack, () => origFetch.apply(self, args));
  };

  // @ts-ignore – http.request on the default (mutable) import
  http.request = function (this: unknown, ...args: Parameters<typeof http.request>) {
    const stack = captureStack();
    const self = this;
    return als.run(stack, () => origHttpRequest.apply(self, args));
  };

  // @ts-ignore
  http.get = function (this: unknown, ...args: Parameters<typeof http.get>) {
    const stack = captureStack();
    const self = this;
    return als.run(stack, () => origHttpGet.apply(self, args));
  };

  // @ts-ignore
  https.request = function (this: unknown, ...args: Parameters<typeof https.request>) {
    const stack = captureStack();
    const self = this;
    return als.run(stack, () => origHttpsRequest.apply(self, args));
  };

  // @ts-ignore
  https.get = function (this: unknown, ...args: Parameters<typeof https.get>) {
    const stack = captureStack();
    const self = this;
    return als.run(stack, () => origHttpsGet.apply(self, args));
  };

  // ── Interceptor ─────────────────────────────────────────────────────────────
  const interceptor = new BatchInterceptor({
    name: 'fineprint-egress',
    interceptors: [new FetchInterceptor(), new ClientRequestInterceptor()],
  });

  interceptor.apply();

  interceptor.on('request', async ({ request, controller }) => {
    const stack = als.getStore();
    const callSite = callSiteFrom(stack, opts.targetRoot);

    // Read body, capped at 64KB
    let body = '';
    try {
      const clone = request.clone();
      const buf = await clone.arrayBuffer();
      const slice = buf.byteLength > MAX_BODY ? buf.slice(0, MAX_BODY) : buf;
      body = new TextDecoder('utf-8').decode(slice);
    } catch {
      body = '';
    }

    const parsed = new URL(request.url);

    // Collect headers, redacting Authorization values
    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      if (name.toLowerCase() === 'authorization') {
        headers[name] = '[redacted]';
      } else {
        headers[name] = value;
      }
    });

    const record: EgressRecord = {
      method: request.method,
      url: request.url,
      host: parsed.host,
      path: parsed.pathname + parsed.search,
      headers,
      body,
      callSite,
    };

    requests.push(record);

    const response =
      opts.respond?.(record) ??
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });

    controller.respondWith(response);
  });

  function stop(): void {
    interceptor.dispose();
    // @ts-ignore
    globalThis.fetch = origFetch;
    // @ts-ignore
    http.request = origHttpRequest;
    // @ts-ignore
    http.get = origHttpGet;
    // @ts-ignore
    https.request = origHttpsRequest;
    // @ts-ignore
    https.get = origHttpsGet;
  }

  function clear(): void {
    requests.length = 0;
  }

  return { requests, stop, clear };
}

export function matchRequest(
  record: EgressRecord,
  fields: { field: string; value: string }[],
): Matched[] {
  // Search URL (raw and decoded), header values, body
  let decoded = '';
  try {
    decoded = decodeURIComponent(record.url);
  } catch {
    decoded = '';
  }

  const headerValues = Object.values(record.headers).join('\n');
  const haystack = [record.url, decoded, headerValues, record.body].join('\n');

  return findCanaries(haystack, fields);
}
