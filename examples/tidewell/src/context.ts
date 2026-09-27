import type { DatabaseSync } from 'node:sqlite';
import type { Logger } from './logger.ts';
import type { BookingsIndex } from './search/bookings-index.ts';
import type { Settings } from './settings.ts';

// Everything a route or job needs, created once per app instance.
export type AppContext = {
  db: DatabaseSync;
  dataDir: string;
  settings: Settings;
  logger: Logger;
  bookings: BookingsIndex;
};
