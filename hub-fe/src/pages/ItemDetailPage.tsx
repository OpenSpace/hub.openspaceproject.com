import React, { useEffect, useState } from 'react';
import {
  IconDownload,
  IconEdit,
  IconHeart,
  IconHeartFilled,
  IconTrash,
  IconFileImport,
  IconMessage
} from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Grid,
  Group,
  Image,
  Paper,
  Select,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core';
import { BundleContents } from '@/components/BundleContents';
import { ItemTypePlaceholder } from '@/components/ItemTypeIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthenticatedRequest } from '@/hooks/useAuthenticatedRequest';
import { useOpenSpaceImport } from '@/hooks/useOpenSpaceImport';
import { ItemDetail, VersionWithFiles } from '@/types/items';
import { UserRef } from '@/types/users';
import { apiFetch, ApiError, apiUrl } from '@/utils/api';
import { formatDate } from '@/utils/dateUtils';
import { getLicenseUrl } from '@/utils/licenseUtils';
import { getTagDisplayName, getTagStyle, sortTags } from '@/utils/tagUtils';
import { linkify } from '@/utils/textUtils';
import { trackItem } from '@/utils/trackItem';

const ItemDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { makeRequest } = useAuthenticatedRequest();
  const { payloadUser, user, showFavoriteCounts, showDownloadCounts, allowImport } = useAuth();
  const theme = useMantineTheme();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<UserRef[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<VersionWithFiles | null>(null);
  const { importToOpenSpace } = useOpenSpaceImport();
  const slackID = import.meta.env.VITE_SLACK_CHANNEL_ID;
  const slackTeam = import.meta.env.VITE_SLACK_TEAM_ID;
  useEffect(() => {
    const fetchItem = async () => {
      try {
        const data = await apiFetch<ItemDetail>(`/api/items/${id}`, { user });
        setItem(data);
        setSelectedVersion(data.currentVersion || null);
        setFavorites(data.favoritedBy || []);
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setError(
            "This item doesn't exist, is unpublished, or you don't have permission to view it."
          );
        } else {
          setError('Failed to load item. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [id, user]);

  const handleFavorite = async () => {
    try {
      const response = await makeRequest<{ favoritedBy: UserRef[] }>(`/api/items/${id}/favorite`, {
        method: 'POST',
      });
      setFavorites(response.favoritedBy);
    } catch (err) {
      console.error('Failed to update favorite status:', err);
    }
  };

  const handleDelete = async () => {
    if (!item) return;
    if (!window.confirm(`Are you sure you want to delete "${item.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await makeRequest(`/api/items/${item.id}`, { method: 'DELETE' });
      navigate('/items');
    } catch (err) {
      console.error('Failed to delete item:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete item.');
    }
  };

  if (loading) {
    return (
      <Container size="xl" py="xl">
        <Text ta="center">Loading...</Text>
      </Container>
    );
  }

  if (error || !item) {
    return (
      <Container size="xl" py="xl">
        <Stack align="center" gap="sm">
          <Title order={3} c="var(--hub-color-heading)">
            Item unavailable
          </Title>
          <Text c="var(--hub-color-dimmed)">
            {error || 'Item not found'}
          </Text>
          <Button component={Link} to="/items" mt="sm">
            Browse items
          </Button>
        </Stack>
      </Container>
    );
  }

  const isAuthor = payloadUser?.id === item.author?.id;
  const displayData = selectedVersion?.snapshot || item;

  return (
    <Container size="xl" py="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Stack gap="xs">
            <Title order={1} size="h3">
              {displayData.title}
            </Title>
            <Group gap="xs" wrap="wrap">
              {sortTags(item.tags ?? []).map((tag) => (
                <Badge key={tag.id} style={getTagStyle(tag.type)} size="sm">
                  {getTagDisplayName(tag)}
                </Badge>
              ))}
            </Group>
          </Stack>
        </Group>

        <Grid>
          <Grid.Col span={{ base: 12, md: 8 }}>
            <Stack gap="md">
              <Paper
                p="md"
                withBorder
                radius={12}
                style={{
                  backgroundColor: 'var(--hub-color-panel)',
                  borderColor: 'rgba(162, 231, 251, 0.12)',
                }}
              >
                <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
                  {displayData.image?.url ? (
                    <Image
                      src={apiUrl(displayData.image.url)}
                      alt={displayData.title ?? undefined}
                      fit="contain"
                      style={{ maxHeight: '350px', display: 'block' }}
                    />
                  ) : (
                    <ItemTypePlaceholder
                      type={displayData.type ?? item.type}
                      height={350}
                      iconSize={120}
                      radius={theme.radius.sm}
                    />
                  )}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      padding: '8px',
                      // Just above the image; anything higher pokes through modals (z-index 200)
                      zIndex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Group gap={4} style={{ position: 'relative' }}>
                      <ActionIcon
                        variant="filled"
                        color={favorites.some((f) => f.id === payloadUser?.id) ? 'red' : 'gray'}
                        onClick={handleFavorite}
                      >
                        {favorites.some((f) => f.id === payloadUser?.id) ? (
                          <IconHeartFilled size={16} />
                        ) : (
                          <IconHeart size={16} />
                        )}
                      </ActionIcon>
                      {showFavoriteCounts && favorites.length > 0 && (
                        <Text
                          size="xs"
                          style={{
                            position: 'absolute',
                            bottom: -4,
                            right: -4,
                            backgroundColor: 'var(--hub-color-panel)',
                            padding: '2px 4px',
                            borderRadius: '10px',
                            border: '1px solid var(--hub-color-panel-border)',
                            minWidth: '16px',
                            textAlign: 'center',
                            lineHeight: 1,
                            zIndex: 1,
                          }}
                        >
                          {favorites.length}
                        </Text>
                      )}
                    </Group>
                  </div>
                </div>
              </Paper>

              <Card
                withBorder
                p="md"
                radius={12}
                style={{
                  backgroundColor: 'var(--hub-color-panel)',
                  borderColor: 'rgba(162, 231, 251, 0.12)',
                }}
              >
                <Text
                  size="sm"
                  c="light-dark(var(--mantine-color-dark-2), var(--mantine-color-gray-3))"
                >
                  {linkify(displayData.description ?? '')}
                </Text>
              </Card>

              <BundleContents
                filename={displayData.assetBundle?.filename}
                filesize={displayData.assetBundle?.filesize}
              />
            </Stack>
          </Grid.Col>

          <Grid.Col span={{ base: 12, md: 4 }}>
            <Stack gap="md">
              <Card
                withBorder
                p="xs"
                radius={12}
                style={{
                  backgroundColor: 'var(--hub-color-panel)',
                  borderColor: 'rgba(162, 231, 251, 0.12)',
                }}
              >
                <Stack gap="xs">
                  <Stack gap={2}>
                    <Text size="xs" fw={500} c="var(--hub-color-heading)">
                      Author
                    </Text>
                    <Anchor
                      component={Link}
                      to={`/profile/${item.author.id}`}
                      size="xs"
                      underline="always"
                    >
                      {item.author.username}
                    </Anchor>
                  </Stack>
                  <Divider size="xs" />
                  <Stack gap={2}>
                    <Text size="xs" fw={500} c="var(--hub-color-heading)">
                      License
                    </Text>
                    {getLicenseUrl(displayData.license) ? (
                      <Anchor
                        href={getLicenseUrl(displayData.license)}
                        target="_blank"
                        rel="noopener noreferrer"
                        size="xs"
                      >
                        {displayData.license}
                      </Anchor>
                    ) : (
                      <Text size="xs" c="var(--hub-color-text)">
                        {displayData.license}
                      </Text>
                    )}
                  </Stack>
                  <Divider size="xs" />
                  <Stack gap={2}>
                    <Text size="xs" fw={500} c="var(--hub-color-heading)">
                      OpenSpace Version
                    </Text>
                    <Text size="xs" c="var(--hub-color-text)">
                      {displayData.openspaceVersion}
                    </Text>
                  </Stack>
                  <Divider size="xs" />
                  <Stack gap={2}>
                    <Text size="xs" fw={500} c="var(--hub-color-heading)">
                      Last Update
                    </Text>
                    <Text size="xs" c="var(--hub-color-text)">
                      {formatDate(selectedVersion?.createdAt || item.updatedAt)}
                    </Text>
                  </Stack>
                  {showDownloadCounts && (
                    <>
                      <Divider size="xs" />
                      <Stack gap={2}>
                        <Text size="xs" fw={500} c="var(--hub-color-heading)">
                          Downloads
                        </Text>
                        <Text size="xs" c="var(--hub-color-text)">
                          {/* Downloads and imports are counted separately but shown as one number */}
                          {((item.downloadCount ?? 0) + (item.importCount ?? 0)).toLocaleString()}
                        </Text>
                      </Stack>
                    </>
                  )}
                </Stack>
              </Card>

              <Card
                withBorder
                p="xs"
                radius={12}
                style={{
                  backgroundColor: 'var(--hub-color-panel)',
                  borderColor: 'rgba(162, 231, 251, 0.12)',
                }}
              >
                <Stack gap="xs">
                  <Text size="xs" fw={500} c="var(--hub-color-heading)">
                    Version
                  </Text>
                  <Select
                    value={selectedVersion?.id}
                    onChange={(value) => {
                      const version =
                        item.archives?.find((v) => v.id === value) || item.currentVersion;
                      setSelectedVersion(version || null);
                    }}
                    data={[
                      ...(item.currentVersion
                        ? [
                            {
                              value: item.currentVersion.id,
                              label: `Version ${item.currentVersion.version} (Latest) (${formatDate(item.currentVersion.createdAt)})`,
                            },
                          ]
                        : []),
                      ...(item.archives || []).map((version) => ({
                        value: version.id,
                        label: `Version ${version.version} (${formatDate(version.createdAt)})`,
                      })),
                    ]}
                    size="xs"
                    disabled={!item.archives?.length && !item.currentVersion}
                    placeholder="Select Version"
                  />
                  <Group mt="xs">
                    <Button
                      component="a"
                      href={
                        displayData.assetBundle?.url ? apiUrl(displayData.assetBundle.url) : undefined
                      }
                      download={displayData.assetBundle?.filename || true}
                      variant="light"
                      size="xs"
                      fullWidth
                      leftSection={<IconDownload size={14} />}
                      disabled={!displayData.assetBundle?.url}
                      onClick={() => trackItem(item.id, 'download')}
                    >
                      Download
                    </Button>
                    {allowImport && (
                      <Button
                        variant="light"
                        size="xs"
                        fullWidth
                        leftSection={<IconFileImport size={14} />}
                        disabled={!displayData.assetBundle?.url}
                        onClick={() =>
                          displayData.assetBundle?.url &&
                          importToOpenSpace(
                            apiUrl(displayData.assetBundle.url),
                            displayData.type ?? item.type,
                            displayData.assetBundle?.filename,
                            displayData.assetBundle?.entryPath,
                            item.id
                          )
                        }
                      >
                        Import
                      </Button>
                    )}
                    <Button
                      variant="light"
                      size="xs"
                      fullWidth
                      leftSection={<IconMessage size={14} />}
                      component="a"
                      href={`slack://channel?team=${slackTeam}&id=${slackID}`}
                    >
                      Discuss on Slack
                    </Button>
                    {isAuthor && (
                      <Button
                        variant="light"
                        size="xs"
                        fullWidth
                        leftSection={<IconEdit size={14} />}
                        onClick={() => navigate(`/items/${id}/edit`)}
                      >
                        Edit
                      </Button>
                    )}
                    {isAuthor && (
                      <Button
                        variant="light"
                        color="red"
                        size="xs"
                        fullWidth
                        leftSection={<IconTrash size={14} />}
                        onClick={handleDelete}
                      >
                        Delete
                      </Button>
                    )}
                  </Group>
                </Stack>
              </Card>
            </Stack>
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
};

export default ItemDetailPage;
