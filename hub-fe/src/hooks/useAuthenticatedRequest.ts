import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch, ApiOptions } from '../utils/api';

export const useAuthenticatedRequest = () => {
  const { user } = useAuth();

  const makeRequest = useCallback(
    async <T = unknown>(endpoint: string, options: Omit<ApiOptions, 'user'> = {}) => {
      if (!user) {
        throw new Error('You must be logged in');
      }
      return apiFetch<T>(endpoint, { ...options, user });
    },
    [user]
  );

  return { makeRequest };
};
