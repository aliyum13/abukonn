import * as Sentry from '@sentry/nextjs';

// Server + edge runtime error monitoring for Next.js.
// Errors only, sampled, no-op when NEXT_PUBLIC_SENTRY_DSN is unset.
export function register() {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === 'nodejs' || process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0,
      sampleRate: 0.5,
      sendDefaultPii: false,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
