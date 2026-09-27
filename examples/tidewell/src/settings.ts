import { z } from 'zod';

// Runtime settings come from the environment. Every provider ID and key has a
// development default so the app boots locally without any real accounts.
const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),
  POSTMARK_SERVER_TOKEN: z.string().default('pm_dev'),
  POSTMARK_FROM: z.string().default('Tidewell <hello@tidewell.example>'),
  TWILIO_ACCOUNT_SID: z.string().default('AC_dev'),
  TWILIO_AUTH_TOKEN: z.string().default('twilio_dev'),
  TWILIO_FROM_NUMBER: z.string().default('+447700900000'),
  STRIPE_SECRET_KEY: z.string().default('sk_test_dev'),
  META_PIXEL_ID: z.string().default('dev-pixel'),
  META_AUDIENCE_ID: z.string().default('dev-audience'),
  META_ACCESS_TOKEN: z.string().default('meta_dev'),
  MAILCHIMP_LIST_ID: z.string().default('dev-list'),
  MAILCHIMP_API_KEY: z.string().default('mc_dev-us21'),
});

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export type Settings = {
  env: string;
  logLevel: LogLevel;
  bcryptRounds: number;
  postmark: { serverToken: string; from: string };
  twilio: { accountSid: string; authToken: string; from: string };
  stripe: { secretKey: string };
  meta: { pixelId: string; audienceId: string; accessToken: string };
  mailchimp: { listId: string; apiKey: string };
};

export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`Invalid environment: ${issue?.path.join('.')}: ${issue?.message}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    logLevel: e.LOG_LEVEL,
    bcryptRounds: e.BCRYPT_ROUNDS,
    postmark: { serverToken: e.POSTMARK_SERVER_TOKEN, from: e.POSTMARK_FROM },
    twilio: {
      accountSid: e.TWILIO_ACCOUNT_SID,
      authToken: e.TWILIO_AUTH_TOKEN,
      from: e.TWILIO_FROM_NUMBER,
    },
    stripe: { secretKey: e.STRIPE_SECRET_KEY },
    meta: {
      pixelId: e.META_PIXEL_ID,
      audienceId: e.META_AUDIENCE_ID,
      accessToken: e.META_ACCESS_TOKEN,
    },
    mailchimp: { listId: e.MAILCHIMP_LIST_ID, apiKey: e.MAILCHIMP_API_KEY },
  };
}
