import axios from 'axios';

// Create API client with environment variables
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication if enabled
if (import.meta.env.VITE_NEXT_PUBLIC_AUTH_ENABLED === 'true') {
  apiClient.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Global error handling
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);
