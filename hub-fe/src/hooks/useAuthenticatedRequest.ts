import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const useAuthenticatedRequest = () => {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const getToken = async () => {
      if (user) {
        const token = await user.getIdToken();
        setToken(token);
      } else {
        setToken(null);
      }
    };
    getToken();
  }, [user]);

  const makeRequest = useCallback(
    async (endpoint: string, options: RequestInit = {}) => {
      if (!token) {
        throw new Error('No authentication token available');
      }
      const response = await fetch(`${import.meta.env.VITE_PAYLOAD_API_URL}${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    },
    [token]
  );

  return { makeRequest };
};
