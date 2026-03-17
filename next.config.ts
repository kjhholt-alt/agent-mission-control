import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

// Sentry configuration options
const sentryConfig = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  tunnelRoute: "/monitoring",

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // New webpack-specific options
  webpack: {
    // Automatically annotate React components
    reactComponentAnnotation: {
      enabled: true,
    },
    // Tree-shake Sentry logger statements
    treeshake: {
      removeDebugLogging: true,
    },
    // Vercel Cron Monitors
    automaticVercelMonitors: true,
  },
};

export default withSentryConfig(nextConfig, sentryConfig);
