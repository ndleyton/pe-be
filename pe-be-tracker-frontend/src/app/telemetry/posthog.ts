import { config } from "@/app/config/env";
import { scheduleIdleTask } from "./scheduleIdleTask";

type PostHogModule = typeof import("posthog-js");
type PostHogClient = PostHogModule["default"];

type AuthenticatedUser = {
  id: string | number;
  email: string;
  name?: string | null;
};

const posthogOptions = {
  api_host: config.posthogHost,
  capture_exceptions: true,
  debug: config.isDevelopment,
  disable_surveys: true,
} as const;

let posthogPromise: Promise<PostHogClient | null> | null = null;
let posthogClient: PostHogClient | null = null;
let posthogInitialized = false;

const canUsePostHog =
  !config.isTest && Boolean(config.posthogApiKey && config.posthogHost);

const loadPostHogClient = async (): Promise<PostHogClient | null> => {
  if (!canUsePostHog) {
    return null;
  }

  if (posthogClient) {
    return posthogClient;
  }

  if (!posthogPromise) {
    posthogPromise = import("posthog-js")
      .then(({ default: posthog }) => {
        if (!posthog.__loaded && !posthogInitialized) {
          posthog.init(config.posthogApiKey, posthogOptions);
          posthogInitialized = true;
        }
        posthogClient = posthog;
        return posthog;
      })
      .catch((error) => {
        console.error("Failed to load PostHog", error);
        return null;
      });
  }

  return posthogPromise;
};

export const schedulePostHogInit = (): (() => void) => {
  if (!canUsePostHog) {
    return () => {};
  }

  return scheduleIdleTask(() => {
    void loadPostHogClient();
  });
};

export const capturePostHogException = (
  error: unknown,
  properties?: Record<string, unknown>,
): void => {
  void loadPostHogClient().then((client) => {
    client?.captureException?.(error, properties);
  });
};

export const identifyPostHogUser = (user: AuthenticatedUser): void => {
  void loadPostHogClient().then((client) => {
    if (!client) {
      return;
    }

    client.identify(String(user.id), {
      email: user.email,
      name: user.name ?? undefined,
    });
    client.register({
      env: config.environment,
      app_version: import.meta.env.VITE_APP_VERSION || "unknown",
      guest: false,
      is_authenticated: true,
    });
  });
};

export const resetPostHogUser = (): void => {
  void loadPostHogClient().then((client) => {
    client?.reset();
  });
};
