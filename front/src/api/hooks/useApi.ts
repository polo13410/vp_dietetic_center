
import { useState, useCallback } from 'react';
import { apiClient } from '../config/axios';
import { handleApiError } from '../utils/errorHandling';
import type { ApiError } from '../utils/errorHandling';

interface UseApiState<T> {
  data: T | null;
  isLoading: boolean;
  error: ApiError | null;
}

interface UseApiOptions {
  showErrorToast?: boolean;
}

/**
 * Custom hook for making API requests with loading and error states
 */
export function useApi<T>(defaultOptions: UseApiOptions = {}) {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    isLoading: false,
    error: null,
  });

  const request = useCallback(
    async <R = T>(
      method: 'get' | 'post' | 'put' | 'delete' | 'patch',
      url: string,
      data?: unknown,
      options: UseApiOptions = {}
    ): Promise<R | null> => {
      // Merge default options with request-specific options
      const mergedOptions = { ...defaultOptions, ...options };
      
      try {
        setState((prev) => ({ ...prev, isLoading: true, error: null }));
        
        const response = await apiClient[method]<R>(url, data);
        
        setState((prev) => ({
          ...prev,
          data: response.data as unknown as T,
          isLoading: false,
        }));
        
        return response.data;
      } catch (error) {
        const formattedError = handleApiError(
          error,
          mergedOptions.showErrorToast ?? true
        );
        
        setState((prev) => ({
          ...prev,
          error: formattedError,
          isLoading: false,
        }));
        
        return null;
      }
    },
    [defaultOptions]
  );

  // Convenience methods for different HTTP verbs
  const get = useCallback(
    <R = T>(url: string, params?: Record<string, any>, options?: UseApiOptions) =>
      request<R>('get', url, { params }, options),
    [request]
  );

  const post = useCallback(
    <R = T>(url: string, data?: unknown, options?: UseApiOptions) =>
      request<R>('post', url, data, options),
    [request]
  );

  const put = useCallback(
    <R = T>(url: string, data?: unknown, options?: UseApiOptions) =>
      request<R>('put', url, data, options),
    [request]
  );

  const patch = useCallback(
    <R = T>(url: string, data?: unknown, options?: UseApiOptions) =>
      request<R>('patch', url, data, options),
    [request]
  );

  const del = useCallback(
    <R = T>(url: string, options?: UseApiOptions) =>
      request<R>('delete', url, undefined, options),
    [request]
  );

  return {
    ...state,
    get,
    post,
    put,
    patch,
    delete: del,
    request,
  };
}
