import axios, {
  AxiosHeaders,
  AxiosInstance,
  AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { config } from "@/app/config/env";
import { Sentry, sentryEnabled } from "@/instrument";

type RequestMetadata = {
  requestId?: string;
};

type RequestWithMetadata = InternalAxiosRequestConfig & {
  metadata?: RequestMetadata;
};

// Centralized Axios configuration leveraging Vite environment variables.
// NOTE: Only variables prefixed with `VITE_` are exposed to the browser bundle.
const apiConfig: AxiosRequestConfig = {
  baseURL: config.apiBaseUrl,
  timeout: config.apiTimeout,
  // Automatically send/receive cookies (needed for FastAPI session auth)
  withCredentials: true,
};

export const apiClient: AxiosInstance = axios.create(apiConfig);

const createRequestId = (): string => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const getHeaderValue = (
  headers: unknown,
  key: string,
): string | undefined => {
  if (!headers) {
    return undefined;
  }
  if (headers instanceof AxiosHeaders) {
    const value = headers.get(key);
    return value == null ? undefined : String(value);
  }
  if (typeof headers === "object") {
    const record = headers as Record<string, unknown>;
    const value =
      record[key] ?? record[key.toLowerCase()] ?? record[key.toUpperCase()];
    if (Array.isArray(value)) {
      return value.join(",");
    }
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
};

const setHeaderValue = (
  request: InternalAxiosRequestConfig,
  key: string,
  value: string,
): void => {
  if (request.headers instanceof AxiosHeaders) {
    request.headers.set(key, value);
    return;
  }

  const headers = AxiosHeaders.from(request.headers);
  headers.set(key, value);
  request.headers = headers;
};

const captureApiError = (error: unknown): void => {
  if (
    !sentryEnabled ||
    !axios.isAxiosError(error) ||
    error.code === "ERR_CANCELED"
  ) {
    return;
  }

  const status = error.response?.status;
  if (status && status < 500) {
    return;
  }

  const request = error.config as RequestWithMetadata | undefined;
  const requestId =
    request?.metadata?.requestId ||
    getHeaderValue(request?.headers, "X-Request-ID") ||
    getHeaderValue(error.response?.headers, "x-request-id");

  Sentry.withScope((scope) => {
    scope.setTag("error_source", "axios");
    if (request?.method) {
      scope.setTag("http_method", request.method.toUpperCase());
    }
    if (status) {
      scope.setTag("http_status", String(status));
    }
    if (requestId) {
      scope.setTag("request_id", requestId);
    }
    scope.setContext("api", {
      baseUrl: request?.baseURL,
      url: request?.url,
      status,
      code: error.code,
      requestId,
      responseRequestId: getHeaderValue(error.response?.headers, "x-request-id"),
    });
    Sentry.captureException(error);
  });
};

export const applyDefaultRequestHeaders = (
  request: InternalAxiosRequestConfig,
): InternalAxiosRequestConfig => {
  if (request.data instanceof FormData) {
    if (request.headers instanceof AxiosHeaders) {
      request.headers.delete("Content-Type");
    } else if (request.headers) {
      delete request.headers["Content-Type"];
    }
    return request;
  }

  if (request.headers instanceof AxiosHeaders) {
    if (!request.headers.has("Content-Type")) {
      request.headers.set("Content-Type", "application/json");
    }
    return request;
  }

  const existingHeaders = AxiosHeaders.from(request.headers);
  if (!existingHeaders.has("Content-Type")) {
    existingHeaders.set("Content-Type", "application/json");
  }
  request.headers = existingHeaders;
  return request;
};

// Request interceptor for auth token injection
apiClient.interceptors.request.use(
  (request) => {
    applyDefaultRequestHeaders(request);
    const requestId = createRequestId();
    (request as RequestWithMetadata).metadata = {
      ...(request as RequestWithMetadata).metadata,
      requestId,
    };
    setHeaderValue(request, "X-Request-ID", requestId);

    // Log outgoing requests in development
    if (config.enableLogging) {
      // eslint-disable-next-line no-console
      // console.log('[API REQUEST]', request);
    }
    return request;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for global error handling
apiClient.interceptors.response.use(
  (response) => {
    if (config.enableLogging) {
      // eslint-disable-next-line no-console
      // console.log('[API RESPONSE]', response);
    }
    return response;
  },
  (error) => {
    // The browser will handle cookie expiration/invalidation.
    // Let components handle guest mode rather than forcing redirects.
    captureApiError(error);

    if (config.enableLogging) {
      const isSessionProbe =
        axios.isAxiosError(error) && error.config?.url?.includes("/auth/session");
      const isUnauthorized =
        axios.isAxiosError(error) && error.response?.status === 401;

      // Don't clutter logs with expected 401s from session probes (guest mode)
      if (!(isSessionProbe && isUnauthorized)) {
        // eslint-disable-next-line no-console
        console.error("[API ERROR]", error);

        // Log detailed error information to help with debugging
        if (error.response) {
          // eslint-disable-next-line no-console
          console.error("[API ERROR] Response data:", error.response.data);
          // eslint-disable-next-line no-console
          console.error("[API ERROR] Response status:", error.response.status);
        } else if (error.request) {
          // eslint-disable-next-line no-console
          console.error("[API ERROR] No response received:", error.request);
        } else {
          // eslint-disable-next-line no-console
          console.error("[API ERROR] Request setup error:", error.message);
        }
      }
    }

    return Promise.reject(error);
  },
);

export default apiClient;
