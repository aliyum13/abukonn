// The mail client is built when a controller loads. Production must behave as it
// always did (real client with a key, a loud boot failure without one); only an
// explicit development opt-in may swap in a logging stand-in.

const test = require('node:test');
const assert = require('node:assert/strict');
const { Resend } = require('resend');
const { createMailer } = require('../src/lib/mailer');

const quiet = fn => async () => {
  const log = console.log;
  const lines = [];
  console.log = (...a) => lines.push(a.join(' '));
  try { await fn(lines); } finally { console.log = log; }
};

test('with a key you get the real Resend client, flag or not', () => {
  assert.ok(createMailer({ RESEND_API_KEY: 're_x' }) instanceof Resend);
  assert.ok(createMailer({ RESEND_API_KEY: 're_x', DEV_SKIP_EXTERNAL_SERVICES: 'true' }) instanceof Resend);
});

test('without a key and without the flag it throws exactly as before (production unchanged)', () => {
  assert.throws(() => createMailer({}), /Missing API key/);
  assert.throws(() => createMailer({ NODE_ENV: 'production' }), /Missing API key/);
  assert.throws(() => createMailer({ DEV_SKIP_EXTERNAL_SERVICES: 'yes' }), /Missing API key/); // only the literal "true"
});

test('the flag is ignored in production', () => {
  assert.throws(
    () => createMailer({ NODE_ENV: 'production', DEV_SKIP_EXTERNAL_SERVICES: 'true' }),
    /Missing API key/
  );
});

test('flag set, not production, no key: a stand-in that logs the email instead of sending it', quiet(async lines => {
  const mailer = createMailer({ DEV_SKIP_EXTERNAL_SERVICES: 'true', NODE_ENV: 'development' });
  assert.ok(!(mailer instanceof Resend));
  const res = await mailer.emails.send({
    from: 'x', to: 'ada@example.com', subject: 'ABUkonn Password Reset',
    html: '<div><h2>Reset</h2><span>  123456  </span><p>If you didn&apos;t ask, ignore.</p></div>',
  });
  assert.deepEqual(res, { data: { id: 'dev-skipped' }, error: null });
  const sent = lines.find(l => l.includes('(dev) not sent'));
  assert.match(sent, /to: ada@example\.com/);
  assert.match(sent, /subject: ABUkonn Password Reset/);
  assert.match(sent, /123456/); // the reset code is readable from the console
  assert.match(sent, /didn't ask/);
  assert.doesNotMatch(sent, /<div>|&apos;/);
}));

test('flag set and NODE_ENV unset counts as not production', quiet(async () => {
  const mailer = createMailer({ DEV_SKIP_EXTERNAL_SERVICES: 'true' });
  assert.ok(!(mailer instanceof Resend));
}));
