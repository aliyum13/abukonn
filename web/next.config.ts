import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
    ],
  },
  // iOS universal links (AASA) and Android App Links (assetlinks.json) are
  // verified by crawlers that expect application/json specifically -- Next's
  // default static-file serving for an extensionless file falls back to
  // application/octet-stream, which some verifiers reject. Force it here
  // rather than relying on the default.
  async headers() {
    return [
      {
        source: '/.well-known/apple-app-site-association',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
      {
        source: '/.well-known/assetlinks.json',
        headers: [{ key: 'Content-Type', value: 'application/json' }],
      },
    ];
  },
};

// Wrap with Sentry. All build-time source-map upload is optional and silently
// skipped when SENTRY_AUTH_TOKEN / org / project aren't set, so the build never
// fails just because Sentry isn't fully configured. Runtime error capture is
// driven purely by NEXT_PUBLIC_SENTRY_DSN.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  sourcemaps: {
    disable: !process.env.SENTRY_AUTH_TOKEN,
  },
  disableLogger: true,
});
