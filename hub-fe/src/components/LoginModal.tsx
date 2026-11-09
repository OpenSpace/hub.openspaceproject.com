import { useEffect, useState } from 'react';

import { IconBrandGithub, IconBrandX, IconLink } from '@tabler/icons-react';
import { FcGoogle } from 'react-icons/fc';
import { FirebaseError } from 'firebase/app';
import {
  AuthProvider,
  GithubAuthProvider,
  GoogleAuthProvider,
  linkWithCredential,
  OAuthCredential,
  signInWithPopup,
  TwitterAuthProvider,
} from 'firebase/auth';
import { Alert, Button, Modal, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { auth } from '../firebase/config';

interface LoginModalProps {
  opened: boolean;
  onClose: () => void;
  mode: 'login' | 'signup';
}

interface LoginProvider {
  name: string;
  color: string;
  icon: React.ReactNode;
  createProvider: () => AuthProvider;
  credentialFromError: (error: FirebaseError) => OAuthCredential | null;
}

const providers: LoginProvider[] = [
  {
    name: 'Google',
    color: '#212121',
    icon: <FcGoogle size={20} />,
    createProvider: () => new GoogleAuthProvider(),
    credentialFromError: (error) => GoogleAuthProvider.credentialFromError(error),
  },
  {
    name: 'GitHub',
    color: '#333333',
    icon: <IconBrandGithub />,
    createProvider: () => new GithubAuthProvider(),
    credentialFromError: (error) => GithubAuthProvider.credentialFromError(error),
  },
  {
    name: 'X.com',
    color: '#333333',
    icon: <IconBrandX />,
    createProvider: () => new TwitterAuthProvider(),
    credentialFromError: (error) => TwitterAuthProvider.credentialFromError(error),
  },
];

// A login that failed because its email already has an account with another provider.
// Once the user signs in with that provider, this credential is linked to their account
interface PendingLink {
  provider: LoginProvider;
  credential: OAuthCredential;
  email?: string;
}

// The user closing or replacing the popup isn't an error worth reporting
const ignoredErrors = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];

export function LoginModal({ opened, onClose, mode }: LoginModalProps) {
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);

  // Start fresh each time the modal opens
  useEffect(() => {
    if (opened) {
      setPendingLink(null);
    }
  }, [opened]);

  const showError = (message: string) =>
    notifications.show({ title: 'Login error', message, color: 'red' });

  const handleLogin = async (provider: LoginProvider) => {
    try {
      const result = await signInWithPopup(auth, provider.createProvider());
      if (pendingLink) {
        // Only link to the account the pending login was for, not whatever account was used
        if (pendingLink.email && result.user.email?.toLowerCase() !== pendingLink.email.toLowerCase()) {
          showError(
            `You signed in as ${result.user.email}, but ${pendingLink.provider.name} uses ` +
              `${pendingLink.email}, so it was not connected.`
          );
        } else {
          await linkWithCredential(result.user, pendingLink.credential);
          notifications.show({
            title: `${pendingLink.provider.name} connected`,
            message: `You can now log in with ${pendingLink.provider.name} or ${provider.name}.`,
            color: 'green',
          });
        }
        setPendingLink(null);
      }
      onClose();
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/account-exists-with-different-credential') {
          const credential = provider.credentialFromError(error);
          if (credential) {
            setPendingLink({
              provider,
              credential,
              email: error.customData?.email as string | undefined,
            });
            return;
          }
        }
        if (ignoredErrors.includes(error.code)) {
          return;
        }
      }
      console.error(`${provider.name} login error:`, error);
      showError(error instanceof Error ? error.message : `Could not log in with ${provider.name}`);
    }
  };

  const action = mode === 'signup' ? 'Sign Up' : 'Login';

  return (
    <Modal opened={opened} onClose={onClose} title={action} centered>
      <Stack>
        {pendingLink && (
          <Alert
            color="blue"
            icon={<IconLink size={18} />}
            title="You already have an account"
            styles={{
              root: {
                backgroundColor:
                  'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))',
              },
              title: { color: 'var(--hub-color-heading)' },
              message: { color: 'var(--hub-color-text)' },
            }}
          >
            {pendingLink.email ? `${pendingLink.email} is` : 'This email is'} already registered
            with a different login. Log in with the method you used before to connect{' '}
            {pendingLink.provider.name} to that account.
          </Alert>
        )}
        {providers
          // While linking, the provider being linked can't be used to log in
          .filter((provider) => provider !== pendingLink?.provider)
          .map((provider) => (
            <Button
              key={provider.name}
              variant="light"
              onClick={() => handleLogin(provider)}
              // Same hover as the theme's other buttons (e.g. the header's Login), set as Button's
              // own CSS vars
              style={{
                '--button-hover': 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-5))',
                '--button-hover-color':
                  'light-dark(var(--mantine-color-dark-3), var(--mantine-color-white))',
              }}
              leftSection={provider.icon}
            >
              {action} with {provider.name}
            </Button>
          ))}
      </Stack>
    </Modal>
  );
}
