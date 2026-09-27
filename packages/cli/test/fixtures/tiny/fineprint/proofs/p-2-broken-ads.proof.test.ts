import { test } from 'vitest';
import { startRun } from '@fineprint/harness';
import { sendSms, trackSignup } from '../../src/app.ts';

const targetRoot = new URL('../..', import.meta.url).pathname;

test('p-2-broken-ads: phone only to Twilio (calls both sendSms and trackSignup)', async () => {
  const run = startRun({ targetRoot });
  const phone = run.canary.phone;

  run.markFlow('sendSms');
  run.markFlow('trackSignup');
  await sendSms(phone);
  await trackSignup(phone);

  run.expect.flowExercised('sendSms');
  run.expect.flowExercised('trackSignup');
  run.expect.egress({ data: ['phone'], onlyTo: ['api.twilio.com'] });
  run.stop();
});
