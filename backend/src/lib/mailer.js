const { Resend } = require('resend');

// The Resend client, built once per controller at require time.
//
// `new Resend(undefined)` THROWS ("Missing API key"), and the controllers built it
// at module scope -- so a backend with no RESEND_API_KEY could not even boot,
// which made a local dev database impossible without an account on a mail
// service. Production is unchanged: with the key set you get the real client, and
// with it missing you still get the same throw at boot (a deploy missing its
// mail key should fail loudly, not silently stop sending password-reset codes).
//
// The only new path is opt-in and never in production: set
// DEV_SKIP_EXTERNAL_SERVICES=true (see .env.example) AND NODE_ENV !== 'production'
// and a missing key yields a stand-in that logs the email instead of sending it.
// The log includes the message text so a developer can read the password-reset
// code from the console.
function createMailer(env = process.env) {
  if (env.RESEND_API_KEY) return new Resend(env.RESEND_API_KEY);

  const devSkip = env.DEV_SKIP_EXTERNAL_SERVICES === 'true' && env.NODE_ENV !== 'production';
  if (!devSkip) return new Resend(env.RESEND_API_KEY); // throws, exactly as before

  console.log('[mailer] RESEND_API_KEY not set -- emails will be logged, not sent (DEV_SKIP_EXTERNAL_SERVICES)');
  return {
    emails: {
      async send(message) {
        const text = String(message.html || message.text || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&apos;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        console.log(`[mailer] (dev) not sent -> to: ${message.to} | subject: ${message.subject} | ${text}`);
        return { data: { id: 'dev-skipped' }, error: null };
      },
    },
  };
}

module.exports = { createMailer };
