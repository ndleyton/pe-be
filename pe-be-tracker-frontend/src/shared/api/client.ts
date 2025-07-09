import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { config } from '@/app/config/env';

// Centralized Axios configuration leveraging Vite environment variables.
// NOTE: Only variables prefixed with `VITE_` are exposed to the browser bundle.
const apiConfig: AxiosRequestConfig = {
  baseURL: config.apiBaseUrl,
  timeout: config.apiTimeout,
  headers: {
    'Content-Type': 'application/json',
  },
  // Automatically send/receive cookies (needed for FastAPI session auth)
  withCredentials: true,
};

export const apiClient: AxiosInstance = axios.create(apiConfig);

// Request interceptor for auth token injection
apiClient.interceptors.request.use(
  (request) => {
    // Log outgoing requests in development
    if (config.enableLogging) {
      // eslint-disable-next-line no-console
      console.log('[API REQUEST]', request);
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
      console.log('[API RESPONSE]', response);
    }
    return response;
  },
  (error) => {
    // The browser will handle cookie expiration/invalidation.
    // Let components handle guest mode rather than forcing redirects.
    
    if (config.enableLogging) {
      // eslint-disable-next-line no-console
      console.error('[API ERROR]', error);
    }
    
    return Promise.reject(error);
  },
);

export default apiClient;