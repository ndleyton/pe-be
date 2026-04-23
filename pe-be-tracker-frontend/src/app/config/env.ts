const environment = import.meta.env.VITE_ENVIRONMENT || "development";

const parseSampleRate = (
  value: string | undefined,
  fallback: number,
): number => {
  const parsed = Number.parseFloat(value ?? "");
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return fallback;
  }
  return parsed;
};

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT ?? "10000", 10),
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || "",
  environment,
  appVersion: import.meta.env.VITE_APP_VERSION || "unknown",
  posthogApiKey: import.meta.env.VITE_PUBLIC_POSTHOG_KEY || "",
  posthogHost: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || "",
  sentryDsn: import.meta.env.VITE_SENTRY_DSN || "",
  sentryTracesSampleRate: parseSampleRate(
    import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE,
    environment === "production" ? 0.1 : 1,
  ),
  sentryReplaysSessionSampleRate: parseSampleRate(
    import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    0,
  ),
  sentryReplaysOnErrorSampleRate: parseSampleRate(
    import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
    1,
  ),
  enableLogging: import.meta.env.VITE_ENABLE_LOGGING === "true",
  isDevelopment: environment === "development",
  isProduction: environment === "production",
  isTest: import.meta.env.MODE === "test",
  sentryEnabled: import.meta.env.MODE !== "test" && !!import.meta.env.VITE_SENTRY_DSN,
} as const;

// Validate required environment variables early to fail fast
if (!config.apiBaseUrl) {
  throw new Error(
    "[CONFIG] Missing required environment variable: VITE_API_BASE_URL",
  );
}

// Only validate PostHog variables if not in test environment
if (!config.isTest) {
  if (!config.posthogApiKey) {
    throw new Error(
      "[CONFIG] Missing required environment variable: VITE_PUBLIC_POSTHOG_KEY",
    );
  }
  if (!config.posthogHost) {
    throw new Error(
      "[CONFIG] Missing required environment variable: VITE_PUBLIC_POSTHOG_HOST",
    );
  }
}
