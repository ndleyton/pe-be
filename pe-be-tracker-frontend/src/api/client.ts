import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

// Centralized Axios configuration leveraging Vite environment variables.
// NOTE: Only variables prefixed with `VITE_` are exposed to the browser bundle.
const config: AxiosRequestConfig = {
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT ?? '10000', 10),
  headers: {
    'Content-Type': 'application/json',
  },
  // Automatically send/receive cookies (needed for FastAPI session auth)
  withCredentials: true,
};

export const apiClient: AxiosInstance = axios.create(config);

// Attach the auth token (if present) to every outgoing request.
apiClient.interceptors.request.use(
  (request) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      request.headers.Authorization = `Bearer ${token}`;
    }

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
      // Invalid / expired credentials – log the user out.
      localStorage.removeItem('authToken');
      // Redirect to login page
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default apiClient; 