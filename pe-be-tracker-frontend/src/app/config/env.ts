export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  apiTimeout: parseInt(import.meta.env.VITE_API_TIMEOUT ?? '10000', 10),
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  environment: import.meta.env.VITE_ENVIRONMENT || 'development',
  enableLogging: import.meta.env.VITE_ENABLE_LOGGING === 'true',
  isDevelopment: import.meta.env.VITE_ENVIRONMENT === 'development',
  isProduction: import.meta.env.VITE_ENVIRONMENT === 'production',
} as const;

// Validate required environment variables early to fail fast
if (!config.apiBaseUrl) {
  throw new Error('[CONFIG] Missing required environment variable: VITE_API_BASE_URL');
}