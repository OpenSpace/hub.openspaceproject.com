import { useEffect, useState } from 'react';
import { IconAlertCircle, IconCheck, IconUpload, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Card,
  Code,
  ComboboxItem,
  FileInput,
  Group,
  Modal,
  Paper,
  Select,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import {
  LOGIN_TO_UPLOAD_MESSAGE,
  UPLOADS_DISABLED_MESSAGE,
  useAuth,
} from '../contexts/AuthContext';
import { useAuthenticatedRequest } from '../hooks/useAuthenticatedRequest';
import { Item, ItemDetail } from '../types/items';
import { link } from 'fs/promises';
import { apiUrl, uploadFile } from '@/utils/api';
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from '@/utils/fieldLimits';
import { ITEM_TYPE_LABELS } from '@/utils/tagUtils';
import { fileTree, UPLOAD_INSTRUCTIONS } from '@/utils/uploadInstructions';

interface ItemFormProps {
  item?: ItemDetail;
  isEdit?: boolean;
}

// The API accepts the value an item already has even if it was since taken off the site config
const withCurrent = (options: string[] = [], current?: string | null) =>
  current && !options.includes(current) ? [...options, current] : options;

// Icon and text as one centered unit, for the file pickers' placeholder and chosen file name
const UploadLabel = ({ children }: { children: React.ReactNode }) => (
  <Group gap={6} justify="center" wrap="nowrap">
    <IconUpload size={16} />
    <span>{children}</span>
  </Group>
);

const FileValue = ({ value }: { value: File | File[] | null }) => (
  <UploadLabel>{Array.isArray(value) ? value.map((file) => file.name).join(', ') : value?.name}</UploadLabel>
);

const fileNoteColor = 'light-dark(var(--mantine-color-dark-5), var(--mantine-color-gray-3))';

// Alert colors with a dark background in dark mode; light mode keeps the variant's own colors
const darkAlertStyles = (border: string) => ({
  root: {
    backgroundColor: 'light-dark(var(--alert-bg), var(--mantine-color-dark-7))',
    borderColor: `light-dark(transparent, ${border})`,
  },
});

export function ItemForm({ item, isEdit = false }: ItemFormProps) {
  const navigate = useNavigate();
  const { makeRequest } = useAuthenticatedRequest();
  const { siteConfig, user, payloadUser, uploadsEnabled, loading: authLoading } = useAuth();
  // Why files can't be uploaded right now, if they can't (the API enforces the same rules).
  // Wait for auth to settle so logged-in users don't see the login message flash
  const uploadBlockedReason = !uploadsEnabled
    ? UPLOADS_DISABLED_MESSAGE
    : !authLoading && !(user && payloadUser)
      ? LOGIN_TO_UPLOAD_MESSAGE
      : undefined;
  const theme = useMantineTheme();

  // Tall boxes for the two file pickers, with the placeholder or file name centered
  const dropBoxStyle = {
    height: 120,
    minHeight: 120,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center' as const,
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    item?.image?.url ? apiUrl(item.image.url) : null
  );
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [assetBundleId, setAssetBundleId] = useState<string | null>(item?.assetBundle?.id || null);
  const [showVersionConfirm, setShowVersionConfirm] = useState(false);
  const [pendingSubmitValues, setPendingSubmitValues] = useState<any>(null);
  
  const [filelabel, setFilelabel] = useState<string>('Asset Files');
  const [fileAccepts, setFileAccepts] = useState<string>('Asset Files');
  const [filePlaceholder, setFilePlaceholder] = useState<string>('Upload a file');
  const [uploadType, setUploadType] = useState<string>(item?.type || 'asset');

  const typeOptions = withCurrent(siteConfig?.itemTypes, item?.type).map((type) => ({
    value: type,
    label: ITEM_TYPE_LABELS[type] || type,
  }));
  const licenseOptions = withCurrent(siteConfig?.licenses, item?.license);
  const versionOptions = withCurrent(siteConfig?.versions, item?.openspaceVersion);

  const form = useForm({
    initialValues: {
      title: item?.title || '',
      description: item?.description || '',
      type: item?.type || '',
      license: item?.license || '',
      openspaceVersion: item?.openspaceVersion || '',
      // Holds the newly selected File, or the existing asset bundle id when editing
      assetBundle: (item?.assetBundle?.id || null) as File | string | null,
    },
    validate: {
      title: (value) => (value.trim().length > 0 ? null : 'Title is required'),
      description: (value) => (value.trim().length > 0 ? null : 'Description is required'),
      type: (value) => (value.trim().length > 0 ? null : 'Type is required'),
      license: (value) => (value.trim().length > 0 ? null : 'License is required'),
      openspaceVersion: (value) =>
        value.trim().length > 0 ? null : 'OpenSpace Version is required',
      assetBundle: (value) => (value ? null : 'A file is required to be loaded'),
    },
  });

  // Update the asset bundle handler to just store the file without uploading
  const handleAssetBundleUpload = (file: File | null) => {
    setAssetFile(file);
    form.setFieldValue('assetBundle', file ?? item?.assetBundle?.id ?? null);
  };

  //change the upload portion of the form based on type
  const handleTypeChange = (_value: string | null, option: ComboboxItem | null) => {
    console.log('2Selected type:', _value);
    setUploadType(_value ?? '');
    switch (_value) {
      case 'asset':
        setFilelabel('Asset or Zip');
        setFileAccepts('.zip,.asset,.jasset');
        setFilePlaceholder('Upload a .asset, a .jasset, or .zip file');
        break;
      case 'profile':
        setFilelabel('Profile');
        setFileAccepts('.profile');
        setFilePlaceholder('Upload a .profile file');
        break;
      case 'recording':
        setFilelabel('Recording File');
        setFileAccepts('.osrec,.osrectxt');
        setFilePlaceholder('Upload a .osrec or .osrectxt file');
        break;
      case 'webpanel':
        setFilelabel('Web Panel Zip');
        setFileAccepts('.zip,.html');
        setFilePlaceholder('Upload a .zip or index.html file');
        break;
      case 'config':
        setFilelabel('Config File');
        setFileAccepts('.json,.zip');
        setFilePlaceholder('Upload a .json or .zip file');
        break;
      case 'package':
        setFilelabel('Package File');
        setFileAccepts('.zip');
        setFilePlaceholder('Upload a .zip file');
        break;
      case 'showcomposer':
        setFilelabel('ShowComposer Panel Zip');
        setFileAccepts('.zip');
        setFilePlaceholder('Upload a .zip file');
        break;
      default:
        setFilelabel('File Upload');
        setFileAccepts('*/*');
        setFilePlaceholder('Upload a file');
        break;
    }
    return form.setFieldValue('type', option?.value || '');
  }

  // Handle image change and upload to media endpoint
  const handleImageChange = (file: File | null) => {
    setImageFile(file);

    if (file) {
      // Show notification for image upload
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

        // Update notification when preview is ready
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
      setImagePreview(item?.image?.url ? apiUrl(item.image.url) : null);
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
        { alt: form.values.title || 'Item image' },
        user
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

  // Upload asset bundle and return the ID
  const uploadAssetBundle = async (file: File, formValues: typeof form.values): Promise<string> => {
    notifications.show({
      id: 'asset-upload',
      loading: true,
      title: 'Uploading Asset Bundle',
      message: 'Validating and uploading your asset bundle...',
      autoClose: false,
      withCloseButton: false,
    });
    try {
      const id = await uploadFile(
        '/api/asset-bundles/validate-and-upload',
        file,
        { title: formValues.title, type: formValues.type },
        user
      );
      notifications.update({
        id: 'asset-upload',
        color: 'green',
        title: 'Asset Bundle Uploaded',
        message: 'Your asset bundle has been validated and uploaded successfully.',
        icon: <IconCheck size={16} />,
        loading: false,
        autoClose: 5000,
      });
      return id;
    } catch (err) {
      notifications.update({
        id: 'asset-upload',
        color: 'red',
        title: 'Upload Failed',
        message: err instanceof Error ? err.message : 'Failed to upload file',
        icon: <IconX size={16} />,
        loading: false,
        autoClose: 5000,
      });
      throw err;
    }
  };

  // Add this function to check if version will change
  const willCreateNewVersion = (values: typeof form.values): boolean => {
    if (!isEdit || !item) return false;

    // Check if license changed
    if (values.license !== item.license) return true;

    // Check if asset bundle changed
    if (assetFile) return true;

    return false;
  };

  // Modify handleSubmit to check for version changes
  const handleSubmit = async (values: typeof form.values) => {
    // Check if this will create a new version
    if (willCreateNewVersion(values)) {
      setShowVersionConfirm(true);
      setPendingSubmitValues(values);
      return;
    }
    console.log('Submitting form with values:', values);
    // Otherwise proceed with normal submission
    await submitForm(values);
  };

  // Extract the actual submission logic to a separate function
  const submitForm = async (values: typeof form.values) => {
    try {
      setLoading(true);
      setError(null);

      notifications.show({
        id: 'form-submit',
        loading: true,
        title: 'Saving Item',
        message: 'Please wait while we save your item...',
        autoClose: false,
        withCloseButton: false,
      });

      let currentAssetBundleId = assetBundleId;
      let imageId = item?.image?.id || null;

      // Upload new files first; each upload shows its own progress and error
      if (assetFile) {
        currentAssetBundleId = await uploadAssetBundle(assetFile, values);
      }
      if (imageFile) {
        imageId = await uploadImage(imageFile);
      }

      // Prepare JSON data for item creation/update
      const jsonData: Record<string, any> = { ...values };

      // Add asset bundle ID if available
      if (currentAssetBundleId) {
        jsonData.assetBundle = currentAssetBundleId;
      }

      // Add image ID if available
      if (imageId) {
        jsonData.image = imageId;
      }
      // Only on create: an edit (e.g. by an admin) must not hand the item to the editor
      if (!isEdit) {
        jsonData.author = payloadUser?.id;
      }

      // Make the request to create or update the item
      const response = await makeRequest<{ doc: Item }>(
        isEdit && item ? `/api/items/${item.id}` : '/api/items',
        { method: isEdit ? 'PATCH' : 'POST', body: jsonData }
      );

      // Update notification for success
      notifications.update({
        id: 'form-submit',
        color: 'green',
        title: isEdit ? 'Item Updated' : 'Item Created',
        message: isEdit
          ? 'Your item has been updated successfully.'
          : 'Your item has been created successfully.',
        icon: <IconCheck size={16} />,
        loading: false,
        autoClose: 5000,
      });

      // Navigate to the item detail page
      navigate(`/items/${response.doc.id}`);
    } catch (err) {
      console.error('Error submitting form:', err);
      const message = err instanceof Error ? err.message : 'Failed to save item. Please try again.';
      setError(message);

      // Update notification for error
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

  // Add this right before the return statement
  useEffect(() => {
    // Reset confirmation dialog when form values change
    if (showVersionConfirm) {
      setShowVersionConfirm(false);
    }
  }, [form.values, assetFile]);

  // Instructions for the selected type. Until one is picked there's nothing to show yet, and
  // some types (profile, recording) need no more than the file itself
  const fileInstructions = UPLOAD_INSTRUCTIONS[form.values.type];
  const fallbackInstruction = form.values.type
    ? 'No special instructions for this type: just upload your file.'
    : 'Select an item type to get instructions.';

  return (
    <Paper
      shadow="sm"
      p="xl"
      radius="md"
      withBorder
      style={{
        backgroundColor: 'var(--hub-color-panel)',
        borderColor: 'var(--hub-color-panel-border)',
      }}
    >
      <Title order={2} mb="lg" c="var(--hub-color-heading)">
        {isEdit ? 'Edit Item' : 'Upload New Item'}
      </Title>

      {error && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="red"
          mb="md"
          styles={darkAlertStyles('var(--mantine-color-red-7)')}
        >
          {error}
        </Alert>
      )}

      {uploadBlockedReason && (
        <Alert icon={<IconAlertCircle size={16} />} color="blue" mb="md">
          {/* Editing already requires login, so here the reason is uploads being switched off */}
          {isEdit
            ? `${uploadBlockedReason}. You can still edit the details, but not replace the files.`
            : uploadBlockedReason}
        </Alert>
      )}

      {/* Add version information display */}
      {isEdit && item?.currentVersion && (
        <Alert color="blue" mb="md" styles={darkAlertStyles('var(--mantine-color-blue-7)')}>
          <Group>
            <Text fw={500} c="var(--hub-color-heading)">
              Current Version: {item.currentVersion.version || '1'}
            </Text>
            {item.archives && item.archives.length > 0 && (
              <Text
                size="sm"
                c="light-dark(var(--mantine-color-dark-5), var(--mantine-color-gray-0))"
              >
                Previous versions: {item.archives.length}
              </Text>
            )}
          </Group>
        </Alert>
      )}

      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <TextInput
            label="Title"
            placeholder="Enter item title"
            required
            maxLength={TITLE_MAX_LENGTH}
            {...form.getInputProps('title')}
          />

          <Textarea
            label="Description"
            placeholder="Enter item description"
            minRows={4}
            required
            maxLength={DESCRIPTION_MAX_LENGTH}
            {...form.getInputProps('description')}
          />
          <Group>
            <Select
              label="Type"
              placeholder="Select item type"
              required
              data={typeOptions}
              searchable
              maxDropdownHeight={400}
              {...form.getInputProps('type')}
              onChange={handleTypeChange}
            />

            <Select
              label="License"
              placeholder="Select license"
              required
              data={licenseOptions}
              searchable
              {...form.getInputProps('license')}
            />

            <Select
              label="OpenSpace Version"
              placeholder="Select OpenSpace version"
              required
              data={versionOptions}
              searchable
              {...form.getInputProps('openspaceVersion')}
            />
          </Group>
          {/* Image and asset file side by side (stacked on narrow screens) */}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Stack gap="xs">
              <FileInput
                label="Image"
                placeholder={<UploadLabel>Upload an image</UploadLabel>}
                accept="image/*"
                onChange={handleImageChange}
                disabled={Boolean(uploadBlockedReason)}
                description={uploadBlockedReason}
                valueComponent={FileValue}
                styles={{ input: dropBoxStyle }}
              />

              {imagePreview && (
                <div>
                  <Text size="sm" mb="xs" c="var(--hub-color-heading)">
                    Image Preview:
                  </Text>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '200px',
                      objectFit: 'contain',
                      border: '1px solid var(--hub-color-panel-border)',
                      borderRadius: theme.radius.sm,
                    }}
                  />
                </div>
              )}
            </Stack>

            <Stack gap="xs">
              <FileInput
                label={filelabel}
                placeholder={<UploadLabel>{filePlaceholder}</UploadLabel>}
                accept={fileAccepts}
                value={assetFile}
                onChange={handleAssetBundleUpload}
                error={form.errors.assetBundle}
                disabled={Boolean(uploadBlockedReason)}
                description={uploadBlockedReason}
                valueComponent={FileValue}
                required
                styles={{ input: dropBoxStyle }}
              />

              {item?.assetBundle && !assetFile && (
                <Text size="sm" c={fileNoteColor}>
                  Current asset: {item.assetBundle.filename}
                </Text>
              )}

              {assetFile && (
                <Text size="sm" c={fileNoteColor}>
                  Selected file: {assetFile.name}
                </Text>
              )}
            </Stack>
          </SimpleGrid>


          {/* Always shown; the content follows the selected type */}
            <Stack gap="xs" mt="lg">
              <Text fw={500} c="var(--hub-color-heading)">
                Upload Instructions
              </Text>
              <Card
                padding="md"
                radius={12}
                withBorder
                style={{
                  backgroundColor: 'var(--hub-color-panel)',
                  borderColor: 'rgba(162, 231, 251, 0.12)',
                }}
              >
                <Stack gap="sm">
                  {(fileInstructions?.paragraphs ?? [fallbackInstruction]).map((paragraph) => (
                    <Text key={paragraph} size="sm" c="var(--hub-color-text)">
                      {paragraph}
                    </Text>
                  ))}
                  {fileInstructions?.example && (
                    <div>
                      <Text
                        size="xs"
                        fw={600}
                        tt="uppercase"
                        mb={6}
                        c="light-dark(var(--mantine-color-gray-7), var(--mantine-color-gray-5))"
                      >
                        Example zip file structure
                      </Text>
                      <Code block style={{ fontSize: 12 }}>
                        {fileTree(fileInstructions.example.zipName, fileInstructions.example.paths)}
                      </Code>
                    </div>
                  )}
                </Stack>
              </Card>
            </Stack>

          {/* Add version confirmation modal */}
          {showVersionConfirm && (
            <Modal
              opened={showVersionConfirm}
              onClose={() => setShowVersionConfirm(false)}
              title="Create New Version"
              styles={{
                title: { color: 'var(--hub-color-heading)' },
                content: { backgroundColor: 'var(--hub-color-panel)' },
              }}
            >
              <Stack>
                <Text c="var(--hub-color-text)">
                  The changes you're making will create a new version of this item. The current
                  version will be archived and a new version will be created.
                </Text>

                <Text fw={500} c="var(--hub-color-heading)">
                  Current version: {item?.currentVersion?.version || '1'}
                </Text>
                <Text fw={500} c="var(--hub-color-heading)">
                  New version:{' '}
                  {item?.currentVersion
                    ? String(parseInt(item.currentVersion.version || '1') + 1)
                    : '1'}
                </Text>

                <Group justify="flex-end" mt="md">
                  <Button variant="outline" onClick={() => setShowVersionConfirm(false)}>
                    Cancel
                  </Button>
                  <Button
                    color="blue"
                    onClick={() => {
                      setShowVersionConfirm(false);
                      if (pendingSubmitValues) {
                        submitForm(pendingSubmitValues);
                      }
                    }}
                  >
                    Confirm New Version
                  </Button>
                </Group>
              </Stack>
            </Modal>
          )}

          <Text
            size="sm"
            mt="md"
            c="light-dark(var(--mantine-color-dark-3), var(--mantine-color-gray-4))"
          >
            By uploading files, you confirm that you have the rights to share them and that you
            have selected the correct license.
          </Text>

          <Group justify="flex-end">
            <Button variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="outline"
              loading={loading}
              disabled={Boolean(uploadBlockedReason) && !isEdit}
              style={{
                '--button-bd': '1px solid var(--mantine-color-yellow-1)',
                '--button-hover': 'var(--mantine-color-yellow-1)',
                '--button-hover-color': 'var(--mantine-color-black)',
              }}
            >
              {isEdit ? 'Save Changes' : 'Upload Item'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Paper>
  );
}
