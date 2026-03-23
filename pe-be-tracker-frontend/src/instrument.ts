import * as Sentry from "@sentry/react";
import { config } from "@/app/config/env";

const FILTERED_VALUE = "[Filtered]";
const SENSITIVE_HEADER_KEYS = new Set(["authorization", "cookie", "x-api-key"]);

const tracePropagationTargets: Array<string | RegExp> = [/^\//];
try {
  tracePropagationTargets.push(new URL(config.apiBaseUrl).origin);
} catch {
  tracePropagationTargets.push(config.apiBaseUrl);
}

const redactRequestHeaders = (headers: Record<string, unknown>) => {
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADER_KEYS.has(key.toLowerCase())) {
      headers[key] = FILTERED_VALUE;
    }
  }
};

export const sentryEnabled = config.sentryEnabled;

if (sentryEnabled) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.environment,
    release: config.appVersion !== "unknown" ? config.appVersion : undefined,
    sendDefaultPii: false,
    debug: config.isDevelopment,
    integrations: [
      Sentry.browserTracingIntegration(),
      ...(config.sentryReplaysSessionSampleRate > 0 ||
      config.sentryReplaysOnErrorSampleRate > 0
        ? [
            Sentry.replayIntegration({
              maskAllText: true,
              blockAllMedia: true,
            }),
          ]
        : []),
    ],
    tracesSampleRate: config.sentryTracesSampleRate,
    tracePropagationTargets,
    replaysSessionSampleRate: config.sentryReplaysSessionSampleRate,
    replaysOnErrorSampleRate: config.sentryReplaysOnErrorSampleRate,
    beforeSend(event) {
      if (event.request?.headers) {
        redactRequestHeaders(event.request.headers as Record<string, unknown>);
      }
      if (event.request?.data) {
        event.request.data = FILTERED_VALUE;
      }
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
      }
      return event;
    },
  });
}

export { Sentry };
