import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { notifications } from '@mantine/notifications';
import { auth } from '../firebase/config'; // We'll create this next
import { apiFetch } from '../utils/api';
import { ItemType } from '../utils/tagUtils';

export const UPLOADS_DISABLED_MESSAGE = 'Uploading currently disabled';
export const SIGNIN_DISABLED_MESSAGE = 'Login and sign up currently disabled';
export const LOGIN_TO_UPLOAD_MESSAGE = 'Log in to upload items';

interface PayloadUser {
  id: string;
  email: string;
  name: string;
  username: string;
  link?: string;
  institution: string;
  thumbnail: string;
  // The profile picture's address, looked up from `thumbnail` (an id) after login
  thumbnailUrl?: string | null;
  role?: string[];
  // Add other Payload user fields as needed
}

// The site-config global (hub-be/src/globals/site-config.ts)
interface SiteConfig {
  // Unset switches count as on, except allowImport, which is off unless true
  upload?: boolean | null;
  signin?: boolean | null;
  showFavoriteCounts?: boolean | null;
  showDownloadCounts?: boolean | null;
  allowImport?: boolean | null;
  versions: string[];
  itemTypes: ItemType[];
  licenses: string[];
}

interface AuthContextType {
  user: User | null;
  payloadUser: PayloadUser | null;
  siteConfig: SiteConfig | null;
  // site-config's `upload` switch (admins can always upload); mirrors the API's check
  uploadsEnabled: boolean;
  // site-config's `signin` switch for logging in / signing up (signed-in users stay signed in)
  signinEnabled: boolean;
  // site-config's `showFavoriteCounts` switch for the number on the favorite hearts
  showFavoriteCounts: boolean;
  // site-config's `showDownloadCounts` switch for the download count on the item detail page
  showDownloadCounts: boolean;
  // site-config's `allowImport` switch for the Import-to-OpenSpace buttons (off unless set to true)
  allowImport: boolean;
  loading: boolean;
  error: string | null;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [payloadUser, setPayloadUser] = useState<PayloadUser | null>(null);
  const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch site configuration
  useEffect(() => {
    const fetchSiteConfig = async () => {
      try {
        setSiteConfig(await apiFetch<SiteConfig>('/api/globals/site-config'));
      } catch (err) {
        console.error('Error fetching site configuration:', err);
      }
    };

    fetchSiteConfig();
  }, []);

  const syncUserWithPayload = async (token: string) => {
    try {
      // Fails with e.g. a 409 when the email belongs to an account this login can't claim
      const userData = await apiFetch<PayloadUser>('/api/register', {
        method: 'POST',
        body: { idToken: token },
      });
      setPayloadUser(userData);
      // The account only has the picture's id, so look up its address for the menu's avatar
      if (typeof userData.thumbnail === 'string') {
        try {
          const { url } = await apiFetch<{ url: string }>(
            `/api/media/${userData.thumbnail}?depth=0`
          );
          setPayloadUser((current) =>
            current && current.id === userData.id ? { ...current, thumbnailUrl: url } : current
          );
        } catch (err) {
          console.error('Error loading the profile picture:', err);
        }
      }
    } catch (err) {
      console.error('Error syncing with Payload:', err);
      const message = err instanceof Error ? err.message : 'Failed to sync with Payload CMS';
      setError(message);
      notifications.show({ title: 'Login failed', message, color: 'red', autoClose: false });
      // Without a Hub account the Firebase session is useless, so don't leave it half logged in
      await auth.signOut();
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setUser(null);
      setPayloadUser(null);
    } catch (err) {
      console.error('Error logging out:', err);
      setError('Failed to logout');
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(
      async (user) => {
        setUser(user);
        if (user) {
          const token = await user.getIdToken();
          await syncUserWithPayload(token);
        } else {
          setPayloadUser(null);
        }
        setLoading(false);
      },
      (error) => {
        setError(error.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    payloadUser,
    siteConfig,
    uploadsEnabled:
      siteConfig?.upload !== false || Boolean(payloadUser?.role?.includes('admin')),
    signinEnabled: siteConfig?.signin !== false,
    showFavoriteCounts: siteConfig?.showFavoriteCounts !== false,
    showDownloadCounts: siteConfig?.showDownloadCounts !== false,
    allowImport: siteConfig?.allowImport === true,
    loading,
    error,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
