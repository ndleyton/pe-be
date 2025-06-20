import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { config } from '@/app/config/env';
import { legacyEndpoints, warnLegacyEndpoint, endpoints } from './endpoints';

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

// Request interceptor for auth token injection and legacy endpoint warnings
apiClient.interceptors.request.use(
  (request) => {
    // Inject auth token if available
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
      request.headers.Authorization = `Bearer ${authToken}`;
    }

    // Check for legacy endpoint usage and warn
    const url = request.url || '';
    if (url === legacyEndpoints.exerciseTypes || url.startsWith(legacyEndpoints.exerciseTypes + '?')) {
      warnLegacyEndpoint(legacyEndpoints.exerciseTypes, endpoints.exerciseTypes);
    } else if (url === legacyEndpoints.intensityUnits || url.startsWith(legacyEndpoints.intensityUnits + '?')) {
      warnLegacyEndpoint(legacyEndpoints.intensityUnits, endpoints.intensityUnits);
    } else if (url === legacyEndpoints.workoutTypes || url.startsWith(legacyEndpoints.workoutTypes + '?')) {
      warnLegacyEndpoint(legacyEndpoints.workoutTypes, endpoints.workoutTypes);
    }

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
    if (error?.response?.status === 401) {
      // 401 means user is not authenticated; clear any stored auth token
      localStorage.removeItem('authToken');
      // Let components handle guest mode rather than forcing redirects
    }
    
    if (config.enableLogging) {
      // eslint-disable-next-line no-console
      console.error('[API ERROR]', error);
    }
    
    return Promise.reject(error);
  },
);

export default apiClient;