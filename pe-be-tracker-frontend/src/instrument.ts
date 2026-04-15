import { config } from "@/app/config/env";
import { scheduleIdleTask } from "@/app/telemetry/scheduleIdleTask";

const FILTERED_VALUE = "[Filtered]";
const SENSITIVE_HEADER_KEYS = new Set(["authorization", "cookie", "x-api-key"]);
type SentryModule = typeof import("@sentry/react");
type ScopeWriter = {
  setTag: (key: string, value: string) => void;
  setContext: (key: string, value: Record<string, unknown>) => void;
};

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

let sentryModule: SentryModule | null = null;
let sentryPromise: Promise<SentryModule | null> | null = null;
let sentryInitialized = false;

const loadSentry = async (): Promise<SentryModule | null> => {
  if (!sentryEnabled) {
    return null;
  }

  if (sentryModule) {
    return sentryModule;
  }

  if (!sentryPromise) {
    sentryPromise = import("@sentry/react")
      .then((module) => {
        if (!sentryInitialized) {
          module.init({
            dsn: config.sentryDsn,
            environment: config.environment,
            release:
              config.appVersion !== "unknown" ? config.appVersion : undefined,
            sendDefaultPii: false,
            debug: config.isDevelopment,
            integrations: [
              module.browserTracingIntegration(),
              ...(config.sentryReplaysSessionSampleRate > 0 ||
              config.sentryReplaysOnErrorSampleRate > 0
                ? [
                    module.replayIntegration({
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
                redactRequestHeaders(
                  event.request.headers as Record<string, unknown>,
                );
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
          sentryInitialized = true;
        }
        sentryModule = module;
        return module;
      })
      .catch((error) => {
        console.error("Failed to load Sentry", error);
        return null;
      });
  }

  return sentryPromise;
};

export const scheduleSentryInit = (): (() => void) => {
  if (!sentryEnabled) {
    return () => {};
  }

  return scheduleIdleTask(() => {
    void loadSentry();
  });
};

export const createSentryReactErrorHandler = () => {
  return (...args: unknown[]) => {
    void loadSentry().then((module) => {
      if (!module) {
        return;
      }

      const handler = module.reactErrorHandler() as (...input: unknown[]) => void;
      handler(...args);
    });
  };
};

export const captureSentryException = (
  error: unknown,
  writeScope?: (scope: ScopeWriter) => void,
): void => {
  void loadSentry().then((module) => {
    if (!module) {
      return;
    }

    module.withScope((scope) => {
      writeScope?.({
        setTag: (key, value) => scope.setTag(key, value),
        setContext: (key, value) => scope.setContext(key, value),
      });
      module.captureException(error);
    });
  });
};

export const setSentryUser = (
  user: {
    id: string;
  } | null,
): void => {
  void loadSentry().then((module) => {
    module?.setUser(user);
  });
};

export const setSentryTag = (key: string, value: string): void => {
  void loadSentry().then((module) => {
    module?.setTag(key, value);
  });
};
