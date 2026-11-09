import { useState } from 'react';
import { IconDownload, IconTrash, IconX } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Anchor,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../contexts/AuthContext';
import { useAuthenticatedRequest } from '../hooks/useAuthenticatedRequest';
import { User } from '../types/users';

interface AccountDataProps {
  user: User;
}

// "Your data" section on your own profile: download what the Hub holds about you, or delete
// your account and everything you uploaded (GDPR rights of access and erasure)
export function AccountData({ user }: AccountDataProps) {
  const { makeRequest } = useAuthenticatedRequest();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [exporting, setExporting] = useState(false);
  const [deleteOpened, setDeleteOpened] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const linkColor = colorScheme === 'dark' ? theme.colors.blue[4] : theme.colors.blue[6];

  const handleExport = async () => {
    try {
      setExporting(true);
      const data = await makeRequest('/api/users/me/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'openspace-hub-data.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Failed to export data:', err);
      notifications.show({
        title: 'Download failed',
        message: 'Could not download your data. Please try again later.',
        color: 'red',
        icon: <IconX size={16} />,
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      await makeRequest(`/api/users/${user.id}`, { method: 'DELETE' });
      await logout();
      notifications.show({
        title: 'Account deleted',
        message: 'Your account and everything you uploaded have been deleted.',
        color: 'green',
      });
      navigate('/');
    } catch (err) {
      console.error('Failed to delete account:', err);
      notifications.show({
        title: 'Delete failed',
        message: 'Could not delete your account. Please try again later.',
        color: 'red',
        icon: <IconX size={16} />,
      });
      setDeleting(false);
    }
  };

  const itemCount = user.items?.docs.length ?? 0;

  return (
    <Stack gap="xs" mt="xl">
      <Title order={4} c={colorScheme === 'dark' ? theme.white : theme.colors.dark[7]}>
        Your data
      </Title>
      <Text size="sm" c={colorScheme === 'dark' ? theme.colors.gray[4] : theme.colors.dark[2]}>
        Download a copy of your profile and items, or delete your account. See the{' '}
        <Anchor style={{ color: linkColor }} component={Link} to="/privacy" size="sm">
          privacy policy
        </Anchor>{' '}
        for what the Hub stores.
      </Text>
      <Group>
        <Button
          variant="default"
          leftSection={<IconDownload size={16} />}
          loading={exporting}
          onClick={handleExport}
        >
          Download my data
        </Button>
        <Button
          color="red"
          variant="outline"
          leftSection={<IconTrash size={16} />}
          onClick={() => setDeleteOpened(true)}
        >
          Delete account
        </Button>
      </Group>

      <Modal
        opened={deleteOpened}
        onClose={() => {
          setDeleteOpened(false);
          setConfirmText('');
        }}
        title="Delete account"
      >
        <Stack gap="md">
          <Text size="sm">
            This permanently deletes your account, your profile and{' '}
            {itemCount === 1 ? 'your item' : `all ${itemCount} of your items`}, including every
            version and uploaded file, and signs you out. It cannot be undone.
          </Text>
          <TextInput
            label={`Type your username (${user.username}) to confirm`}
            value={confirmText}
            onChange={(event) => setConfirmText(event.currentTarget.value)}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDeleteOpened(false)}>
              Cancel
            </Button>
            <Button
              color="red"
              loading={deleting}
              disabled={confirmText.trim() !== user.username}
              onClick={handleDelete}
            >
              Delete my account
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
