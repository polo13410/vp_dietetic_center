
import { AxiosError } from 'axios';
import { toast } from '@/components/ui/use-toast';

export interface ApiError {
  status?: number;
  message: string;
  details?: string;
  originalError?: unknown;
}

/**
 * Extract and format error from API response
 */
export const extractApiError = (error: unknown): ApiError => {
  if (error instanceof AxiosError) {
    const response = error.response;
    return {
      status: response?.status,
      message: response?.data?.message || error.message || 'An error occurred',
      details: response?.data?.details || response?.statusText,
      originalError: error,
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message || 'An unknown error occurred',
      originalError: error,
    };
  }
  
  return {
    message: 'An unknown error occurred',
    originalError: error,
  };
};

/**
 * Handle API errors with optional toast notification
 */
export const handleApiError = (error: unknown, showToast = true): ApiError => {
  const formattedError = extractApiError(error);
  
  if (showToast) {
    toast({
      title: 'Error',
      description: formattedError.message,
      variant: 'destructive',
    });
  }
  
  console.error('API Error:', formattedError);
  return formattedError;
};
