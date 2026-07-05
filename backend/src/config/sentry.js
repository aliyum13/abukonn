const Sentry = require('@sentry/node');

/**
 * Initialises Sentry error monitoring for the backend.
 *
 * Errors-only configuration (no performance tracing) to stay well within
 * Sentry's free tier. If SENTRY_DSN is not set, Sentry does nothing — so this
 * is safe to run in any environment, including local dev, without a key.
 *
 * Billing safety: there is NO payment method on the Sentry account, so even if
 * the free-tier event quota is exceeded, Sentry simply stops accepting events
 * for the rest of the month — it never charges. On top of that, the sample
 * rate below caps how many error events we send even during an error storm, so
 * one broken loop can't burn the whole month's quota.
 */
function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('Sentry DSN not set — error monitoring disabled');
    return false;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',

    // Errors only — no performance tracing (tracesSampleRate omitted / 0)
    tracesSampleRate: 0,

    // Send at most this fraction of error events. 1.0 = all errors; lowered
    // here to 0.5 as a safety cap so a runaway error can't flood the quota.
    // Raise toward 1.0 later if volume is comfortably low.
    sampleRate: 0.5,

    // Don't attach request bodies (may contain personal data / tokens)
    sendDefaultPii: false,

    ignoreErrors: [
      // Common noise that isn't actionable
      'Non-Error promise rejection captured',
    ],
  });

  console.log('Sentry error monitoring initialised');
  return true;
}

module.exports = { Sentry, initSentry };
