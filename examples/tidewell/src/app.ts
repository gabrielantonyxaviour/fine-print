import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import express, { type Express } from 'express';
import type { AppContext } from './context.ts';
import { openDatabase } from './db.ts';
import { createLogger } from './logger.ts';
import { loadSettings, type Settings } from './settings.ts';
import { createBookingsIndex } from './search/bookings-index.ts';
import { attachSession } from './middleware/session.ts';
import { requestLog } from './middleware/request-log.ts';
import { createErrorHandler } from './lib/http.ts';
import { authRoutes } from './routes/auth.ts';
import { clinicRoutes } from './routes/clinics.ts';
import { appointmentRoutes } from './routes/appointments.ts';
import { paymentRoutes } from './routes/payments.ts';
import { meRoutes } from './routes/me.ts';
import { testRoutes } from './routes/test-routes.ts';

export type CreateAppOptions = {
  dataDir?: string;
  settings?: Settings;
  testRoutes?: boolean;
};

export type TidewellApp = {
  app: Express;
  context: AppContext;
  close(): void;
};

export function createApp(options: CreateAppOptions = {}): TidewellApp {
  const dataDir = options.dataDir ?? './data';
  const settings = options.settings ?? loadSettings();
  mkdirSync(dataDir, { recursive: true });

  const logger = createLogger(join(dataDir, 'logs', 'app.log'), settings.logLevel);
  const db = openDatabase(join(dataDir, 'tidewell.db'));
  const bookings = createBookingsIndex(join(dataDir, 'search-index.json'));
  const context: AppContext = { db, dataDir, settings, logger, bookings };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));
  app.use(requestLog(logger));
  app.use(attachSession(context));

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api', authRoutes(context));
  app.use('/api', clinicRoutes(context));
  app.use('/api', appointmentRoutes(context));
  app.use('/api', paymentRoutes(context));
  app.use('/api', meRoutes(context));

  const enableTestRoutes = options.testRoutes ?? process.env.NODE_ENV === 'test';
  if (enableTestRoutes) app.use('/__test', testRoutes(context));

  app.use(createErrorHandler(logger));

  return { app, context, close: () => db.close() };
}
