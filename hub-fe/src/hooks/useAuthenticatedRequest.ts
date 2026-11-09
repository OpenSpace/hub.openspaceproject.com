import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useAuthenticatedRequest = () => {
  const { user } = useAuth();

  const makeRequest = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      if (!user) {
        throw new Error('No authentication token available');
      }
      // Returns the cached token, refreshing it only when it is about to expire.
      const token = await user.getIdToken();

      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      if (typeof options.body === 'string' && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      const response = await fetch(`${import.meta.env.VITE_PAYLOAD_API_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    [user]
  );

  return { makeRequest };
};
