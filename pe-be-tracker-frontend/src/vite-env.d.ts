/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_TIMEOUT: string;
  readonly VITE_ENABLE_LOGGING: string;
  readonly VITE_ENVIRONMENT: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_PUBLIC_POSTHOG_KEY: string;
  readonly VITE_PUBLIC_POSTHOG_HOST: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE: string;
  readonly VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: string;
  readonly VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: string;
  // Add any additional custom env vars below
  // readonly VITE_APP_TITLE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
