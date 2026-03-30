import { NAV_PATHS } from "@/shared/navigation/constants";

const POST_LOGIN_DESTINATION_KEY = "auth:post-login-destination";

const getSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const sanitizePostLoginDestination = (value: string | null): string | null => {
  if (
    !value
    || !value.startsWith("/")
    || value.startsWith("//")
    || typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const destination = new URL(value, window.location.origin);

    if (
      destination.origin !== window.location.origin
      || destination.pathname === NAV_PATHS.LOGIN
    ) {
      return null;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return null;
  }
};

export const getPostLoginDestination = (search: string): string => {
  const params = new URLSearchParams(search);
  return sanitizePostLoginDestination(params.get("next")) ?? NAV_PATHS.WORKOUTS;
};

export const persistPostLoginDestination = (path: string): void => {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(POST_LOGIN_DESTINATION_KEY, path);
  } catch {
    /* ignore */
  }
};

export const consumePostLoginDestination = (): string | null => {
  const storage = getSessionStorage();
  if (!storage) {
    return null;
  }

  try {
    const destination = storage.getItem(POST_LOGIN_DESTINATION_KEY);
    storage.removeItem(POST_LOGIN_DESTINATION_KEY);
    return sanitizePostLoginDestination(destination);
  } catch {
    return null;
  }
};
