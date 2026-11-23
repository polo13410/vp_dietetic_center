import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

// Avoid circular import — import lazily
import { useAuthStore } from '../stores/authStore';

// Same origin everywhere: Vite (dev) and nginx (deployed) forward /api to the API,
// so the refresh-token cookie is first-party and no CORS is needed.
const BASE_URL = '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

// Attach access token
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/** A refused sign-in is answered on the sign-in page: no session to refresh. */
const SIGN_IN_URLS = ['/auth/google', '/auth/dev-login'];

// Handle 401 — refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (SIGN_IN_URLS.some((url) => original.url?.includes(url))) {
        return Promise.reject(error);
      }
      if (original.url?.includes('/auth/refresh')) {
        useAuthStore.getState().logout();
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original));
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post<{ accessToken: string }>('/auth/refresh');
        useAuthStore.getState().setAccessToken(data.accessToken);
        processQueue(null);
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default api;
