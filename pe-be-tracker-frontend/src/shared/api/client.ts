import axios, {
  AxiosHeaders,
  AxiosInstance,
  AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";
import { config } from "@/app/config/env";

// Centralized Axios configuration leveraging Vite environment variables.
// NOTE: Only variables prefixed with `VITE_` are exposed to the browser bundle.
const apiConfig: AxiosRequestConfig = {
  baseURL: config.apiBaseUrl,
  timeout: config.apiTimeout,
  // Automatically send/receive cookies (needed for FastAPI session auth)
  withCredentials: true,
};

export const apiClient: AxiosInstance = axios.create(apiConfig);

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

    if (config.enableLogging) {
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

    return Promise.reject(error);
  },
);

export default apiClient;
