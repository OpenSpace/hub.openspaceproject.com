import React, { useState } from 'react';
import {
  Button,
  Checkbox,
  FileInput,
  Group,
  Loader,
  LoadingOverlay,
  Modal,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';

interface UploadItemModalProps {
  opened: boolean;
  onClose: () => void;
}

const UploadItemModal: React.FC<UploadItemModalProps> = ({ opened, onClose }) => {
  const [assetName, setAssetName] = useState('');
  const [assetDescription, setAssetDescription] = useState('');
  const [assetType, setAssetType] = useState<string | null>('');
  const [openSpaceVersion, setOpenSpaceVersion] = useState<string | null>('');
  const [license, setLicense] = useState<string | null>('');
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorModalOpened, setErrorModalOpened] = useState(false);
  const [successModalOpened, setSuccessModalOpened] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const assetTypes = ['asset', 'profile', 'recording', 'webpanel', 'config', 'showcomposer', 'package'];
  const openSpaceVersions = [
    '0.20.1',
    '0.20.0',
    '0.19.2',
    '0.19.1',
    '0.19.0',
    '0.18.2',
    '0.18.1',
    '0.18.0',
    '0.17.2',
  ];
  const licenses = [
    'CC BY',
    'CC BY-SA',
    'CC BY-NC',
    'CC BY-NC-SA',
    'CC BY-ND',
    'CC BY-NC-ND',
    'CC0',
    'MIT',
    'Apache',
    'GPL',
    'LGPL',
    'BSD',
    'Proprietary',
  ];

  const validateForm = () => {
    const newErrors: string[] = [];
    if (!assetName) newErrors.push('Asset Name is required.');
    if (!assetDescription) newErrors.push('Asset Description is required.');
    if (!assetType) newErrors.push('Asset Type is required.');
    if (!openSpaceVersion) newErrors.push('OpenSpace Version is required.');
    if (!license) newErrors.push('License is required.');
    if (!imageFile) newErrors.push('Image Upload is required.');
    if (!assetFile) newErrors.push('Asset File Upload is required.');
    if (!termsAccepted) newErrors.push('You must accept the terms and conditions.');

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleUpload = async () => {
    if (!validateForm()) {
      setErrorModalOpened(true);
      return;
    }

    setLoading(true);
    setUploadMessage('');
    // Simulate an upload process
    try {
      // Here you would typically handle the upload logic
      // For example, using FormData to send the files to your server
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate a delay
      setUploadSuccess(true);
      setUploadMessage('Upload successful!');
      setSuccessModalOpened(true);
      onClose();
    } catch (error) {
      setUploadSuccess(false);
      setUploadMessage('Upload failed. Please try again.');
      setSuccessModalOpened(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal opened={opened} onClose={onClose} title="Upload an Item" size="xl">
        <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ radius: 'sm', blur: 2 }} />
        <Stack>
          <Group grow>
            <TextInput
              label="Asset Name"
              placeholder="Enter asset name"
              value={assetName}
              onChange={(event) => setAssetName(event.currentTarget.value)}
            />
          </Group>
          <Textarea
            label="Asset Description"
            placeholder="Enter asset description"
            value={assetDescription}
            onChange={(event) => setAssetDescription(event.currentTarget.value)}
          />
          <Group grow>
            <Select
              label="Asset Type"
              placeholder="Select asset type"
              data={assetTypes}
              value={assetType}
              onChange={setAssetType}
            />
            <Select
              label="OpenSpace Version"
              placeholder="Select OpenSpace version"
              data={openSpaceVersions}
              value={openSpaceVersion}
              onChange={setOpenSpaceVersion}
            />
            <Select
              label="License"
              placeholder="Select license"
              data={licenses}
              value={license}
              onChange={setLicense}
            />
          </Group>
          <Textarea label="Asset Type Description" placeholder="Enter asset type description" />
          <FileInput
            label="Image Upload"
            placeholder="Upload an image"
            onChange={setImageFile}
            accept="image/*"
          />
          <FileInput
            label="Asset File Upload (.zip, .asset)"
            placeholder="Upload asset file"
            onChange={setAssetFile}
            accept=".zip,.asset"
          />
          <Checkbox
            label="I accept the terms and conditions"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.currentTarget.checked)}
          />
          <Group>
            <Button onClick={handleUpload} disabled={loading}>
              {loading ? <Loader size="sm" /> : 'Upload'}
            </Button>
            <Button onClick={onClose} variant="outline">
              Cancel
            </Button>
          </Group>
        </Stack>
      </Modal>

      <Modal
        opened={errorModalOpened}
        onClose={() => setErrorModalOpened(false)}
        title="Validation Errors"
      >
        <Text c="red">
          {errors.length > 0 ? (
            errors.map((error, index) => <div key={index}>{error}</div>)
          ) : (
            <div>No validation errors.</div>
          )}
        </Text>
        <Button onClick={() => setErrorModalOpened(false)} style={{ marginTop: '10px' }}>
          Close
        </Button>
      </Modal>

      <Modal
        opened={successModalOpened}
        onClose={() => setSuccessModalOpened(false)}
        title={uploadSuccess ? 'Upload Successful' : 'Upload Failed'}
      >
        <Text color={uploadSuccess ? 'green' : 'red'}>{uploadMessage}</Text>
        <Button onClick={() => setSuccessModalOpened(false)} style={{ marginTop: '10px' }}>
          Close
        </Button>
      </Modal>
    </>
  );
};

export default UploadItemModal;
