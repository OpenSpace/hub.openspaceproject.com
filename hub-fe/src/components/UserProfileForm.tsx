import { useState } from 'react';
import { IconAlertCircle, IconCheck, IconUpload, IconX } from '@tabler/icons-react';
import {
  Alert,
  Button,
  FileInput,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../contexts/AuthContext';
import { useAuthenticatedRequest } from '../hooks/useAuthenticatedRequest';
import { Populated } from '../types/items';
import { User } from '../types/users';
import { apiUrl, uploadFile } from '../utils/api';
import {
  LINK_MAX_LENGTH,
  linkError,
  USERNAME_MAX_LENGTH,
  usernameError,
} from '../utils/fieldLimits';

interface UserProfileFormProps {
  user: Populated<User, 'thumbnail'>;
}

export function UserProfileForm({ user }: UserProfileFormProps) {
  const { makeRequest } = useAuthenticatedRequest();
  const { user: firebaseUser } = useAuth();
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    user?.thumbnail?.url ? apiUrl(user.thumbnail.url) : null
  );
  const [imageFile, setImageFile] = useState<File | null>(null);

  const form = useForm({
    initialValues: {
      username: user?.username || '',
      institution: user?.institution || '',
      slackHandle: user?.slackHandle || '',
      link: user?.link || '',
      contactEmail: user?.contactEmail || '',
    },
    validate: {
      username: (value) => usernameError(value.trim()),
      institution: (value) => (value.trim().length > 0 ? null : 'Institution is required'),
      link: (value) => linkError(value.trim()),
    },
    transformValues: (values) => ({
      ...values,
      username: values.username.trim(),
      link: values.link.trim(),
    }),
  });

  // Handle image change and upload to media endpoint
  const handleImageChange = (file: File | null) => {
    setImageFile(file);

    if (file) {
      notifications.show({
        id: 'image-preview',
        title: 'Image Selected',
        message: 'Preview is being generated...',
        loading: true,
        autoClose: false,
      });

      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);

        notifications.update({
          id: 'image-preview',
          title: 'Image Preview Ready',
          message: 'Image has been processed and is ready for upload.',
          color: 'green',
          icon: <IconCheck size={16} />,
          loading: false,
          autoClose: 3000,
        });
      };
      reader.readAsDataURL(file);
    } else {
      setImagePreview(user?.thumbnail?.url ? apiUrl(user.thumbnail.url) : null);
    }
  };

  // Upload image to media endpoint and return the ID
  const uploadImage = async (file: File): Promise<string> => {
    notifications.show({
      id: 'image-upload',
      loading: true,
      title: 'Uploading Image',
      message: 'Uploading your image...',
      autoClose: false,
      withCloseButton: false,
    });
    try {
      const id = await uploadFile(
        '/api/media',
        file,
        { alt: form.values.username || 'Profile image' },
        firebaseUser
      );
      notifications.update({
        id: 'image-upload',
        color: 'green',
        title: 'Image Uploaded',
        message: 'Your image has been uploaded successfully.',
        icon: <IconCheck size={16} />,
        loading: false,
        autoClose: 5000,
      });
      return id;
    } catch (err) {
      notifications.update({
        id: 'image-upload',
        color: 'red',
        title: 'Image Upload Failed',
        message: err instanceof Error ? err.message : 'Failed to upload image',
        icon: <IconX size={16} />,
        loading: false,
        autoClose: 5000,
      });
      throw err;
    }
  };

  const handleSubmit = async (values: typeof form.values) => {
    try {
      setLoading(true);
      setError(null);

      notifications.show({
        id: 'form-submit',
        loading: true,
        title: 'Saving Profile',
        message: 'Please wait while we save your profile...',
        autoClose: false,
        withCloseButton: false,
      });

      let imageId = user?.thumbnail?.id || null;

      // Upload image if a new file is selected; the upload shows its own progress and error
      if (imageFile) {
        imageId = await uploadImage(imageFile);
      }

      // Prepare JSON data for profile update
      const jsonData: Record<string, any> = { ...values };

      // Add image ID if available
      if (imageId) {
        jsonData.thumbnail = imageId;
      }

      // Make the request to update the profile
      await makeRequest(`/api/users/${user.id}`, { method: 'PATCH', body: jsonData });

      // Update notification for success
      notifications.update({
        id: 'form-submit',
        color: 'green',
        title: 'Profile Updated',
        message: 'Your profile has been updated successfully.',
        icon: <IconCheck size={16} />,
        loading: false,
        autoClose: 5000,
      });

      // Refresh the page to show updated data
      window.location.reload();
    } catch (err) {
      console.error('Error submitting form:', err);
      const message =
        err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
      setError(message);

      notifications.update({
        id: 'form-submit',
        color: 'red',
        title: 'Submission Failed',
        message,
        icon: <IconX size={16} />,
        loading: false,
        autoClose: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper
      shadow="sm"
      p="xl"
      radius="md"
      withBorder
      style={{
        backgroundColor: colorScheme === 'dark' ? theme.colors.dark[8] : theme.white,
        borderColor: colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[3],
      }}
    >
      <Title order={2} mb="lg" c={colorScheme === 'dark' ? theme.white : theme.colors.dark[7]}>
        Edit Profile
      </Title>

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
          {error}
        </Alert>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Username"
            placeholder="Enter your username"
            required
            maxLength={USERNAME_MAX_LENGTH}
            styles={{
              label: {
                color: colorScheme === 'dark' ? theme.white : theme.colors.dark[7],
              },
            }}
            {...form.getInputProps('username')}
          />

          <TextInput
            label="Institution"
            placeholder="Enter your institution"
            required
            styles={{
              label: {
                color: colorScheme === 'dark' ? theme.white : theme.colors.dark[7],
              },
            }}
            {...form.getInputProps('institution')}
          />

          <TextInput
            label="Slack Handle"
            placeholder="Enter your Slack handle"
            styles={{
              label: {
                color: colorScheme === 'dark' ? theme.white : theme.colors.dark[7],
              },
            }}
            {...form.getInputProps('slackHandle')}
          />

          <TextInput
            label="Link"
            placeholder="https://example.com (optional)"
            maxLength={LINK_MAX_LENGTH}
            styles={{
              label: {
                color: colorScheme === 'dark' ? theme.white : theme.colors.dark[7],
              },
            }}
            {...form.getInputProps('link')}
          />

          <TextInput
            label="Contact Email"
            description="Optional. This email will only be shown to other logged-in hub users."
            placeholder="Enter an email people can reach you at"
            type="email"
            styles={{
              label: {
                color: colorScheme === 'dark' ? theme.white : theme.colors.dark[7],
              },
            }}
            {...form.getInputProps('contactEmail')}
          />

          <FileInput
            label="Profile Image"
            placeholder="Upload a profile image"
            accept="image/*"
            onChange={handleImageChange}
            leftSection={<IconUpload size={16} />}
            styles={{
              label: {
                color: colorScheme === 'dark' ? theme.white : theme.colors.dark[7],
              },
            }}
          />

          {imagePreview && (
            <div>
              <Text
                size="sm"
                mb="xs"
                c={colorScheme === 'dark' ? theme.white : theme.colors.dark[7]}
              >
                Image Preview:
              </Text>
              <img
                src={imagePreview}
                alt="Preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: '200px',
                  objectFit: 'contain',
                  border: `1px solid ${colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[3]}`,
                  borderRadius: theme.radius.sm,
                }}
              />
            </div>
          )}

          <Group justify="flex-end" mt="xl">
            <Button
              type="submit"
              variant="outline"
              loading={loading}
              style={{
                '--button-bd': '1px solid var(--mantine-color-yellow-1)',
                '--button-hover': 'var(--mantine-color-yellow-1)',
                '--button-hover-color': 'var(--mantine-color-black)',
              }}
            >
              Save Changes
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
