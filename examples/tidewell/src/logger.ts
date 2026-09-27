import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { LogLevel } from './settings.ts';

const ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export type LogFields = Record<string, unknown>;

export type Logger = {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
};

// Structured JSON-lines logger. Each line is one event, which keeps the file
// easy to ship to our log search and easy to grep locally.
export function createLogger(file: string, level: LogLevel): Logger {
  mkdirSync(dirname(file), { recursive: true });

  const write = (lineLevel: LogLevel, msg: string, fields: LogFields = {}) => {
    if (ORDER[lineLevel] < ORDER[level]) return;
    const line = { time: new Date().toISOString(), level: lineLevel, msg, ...fields };
    appendFileSync(file, `${JSON.stringify(line)}\n`);
  };

  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
  };
}
