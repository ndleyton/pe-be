import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// Validate required environment variables early to fail fast.
const baseURL = import.meta.env.VITE_API_BASE_URL;
if (!baseURL) {
  throw new Error('[API CLIENT] Missing required environment variable: VITE_API_BASE_URL');
}

// Centralized Axios configuration leveraging Vite environment variables.
// NOTE: Only variables prefixed with `VITE_` are exposed to the browser bundle.
const config: AxiosRequestConfig = {
  baseURL: baseURL,
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT ?? '10000', 10),
  headers: {
    'Content-Type': 'application/json',
  },
  // Automatically send/receive cookies (needed for FastAPI session auth)
  withCredentials: true,
};

export const apiClient: AxiosInstance = axios.create(config);

// Log outgoing requests in development
apiClient.interceptors.request.use(
  (request) => {
    if (import.meta.env.VITE_ENABLE_LOGGING === 'true') {
      // eslint-disable-next-line no-console
      console.log('[API REQUEST]', request);
    }
    return request;
  },
  (error) => Promise.reject(error),
);

// Global response handling
apiClient.interceptors.response.use(
  (response) => {
    if (import.meta.env.VITE_ENABLE_LOGGING === 'true') {
      // eslint-disable-next-line no-console
      console.log('[API RESPONSE]', response);
    }
    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      // 401 means user is not authenticated; we just let components handle guest mode.
      // Avoid redirect loops by NOT forcing navigation here.
    }
    return Promise.reject(error);
  },
);

export default apiClient; 