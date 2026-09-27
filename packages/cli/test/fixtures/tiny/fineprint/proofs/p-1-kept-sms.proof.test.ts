import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { sendSms } from '../../src/app.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-1-kept-sms: phone only to Twilio', async () => {
  const run = startRun({ targetRoot });
  const phone = run.canary.phone;

  run.markFlow('sendSms');
  await sendSms(phone);

  run.expect.flowExercised('sendSms');
  run.expect.egress({ data: ['phone'], onlyTo: ['api.twilio.com'] });
  run.stop();
});
