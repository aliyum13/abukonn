import * as Sentry from '@sentry/nextjs';

// Client-side (browser) error monitoring.
// Errors only, sampled, and a no-op when NEXT_PUBLIC_SENTRY_DSN is not set —
// safe to ship without a key. Billing is impossible because there is no
// payment method on the Sentry account; exceeding the free quota just pauses
// collection until next month.
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'production',
    // Errors only — no performance tracing
    tracesSampleRate: 0,
    // Cap error events sent even during an error storm
    sampleRate: 0.5,
    // No session replay (would use quota + capture PII)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  });
}
