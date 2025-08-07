export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT ?? '10000', 10),
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  posthogApiKey: import.meta.env.VITE_PUBLIC_POSTHOG_KEY || '',
  posthogHost: import.meta.env.VITE_PUBLIC_POSTHOG_HOST || '',
  enableLogging: import.meta.env.VITE_ENABLE_LOGGING === 'true',
  isDevelopment: import.meta.env.VITE_ENVIRONMENT === 'development',
  isProduction: import.meta.env.VITE_ENVIRONMENT === 'production',
  isTest: import.meta.env.MODE === 'test',
} as const;

// Debug environment variables in development
if (import.meta.env.DEV) {
  console.log('[CONFIG] Environment debug:', {
    MODE: import.meta.env.MODE,
    VITE_ENVIRONMENT: import.meta.env.VITE_ENVIRONMENT,
    VITE_PUBLIC_POSTHOG_KEY: import.meta.env.VITE_PUBLIC_POSTHOG_KEY,
    VITE_PUBLIC_POSTHOG_HOST: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
    isTest: config.isTest,
    posthogApiKey: config.posthogApiKey,
    posthogHost: config.posthogHost
  });
}

// Validate required environment variables early to fail fast
if (!config.apiBaseUrl) {
  throw new Error('[CONFIG] Missing required environment variable: VITE_API_BASE_URL');
}

// Only validate PostHog variables if not in test environment
if (!config.isTest) {
  if (!config.posthogApiKey) {
    throw new Error('[CONFIG] Missing required environment variable: VITE_PUBLIC_POSTHOG_KEY');
  }
  if (!config.posthogHost) {
    throw new Error('[CONFIG] Missing required environment variable: VITE_PUBLIC_POSTHOG_HOST');
  }
}