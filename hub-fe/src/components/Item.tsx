import React, { useState } from 'react';
import {
  IconDownload,
  IconEdit,
  IconFileImport,
  IconHeart,
  IconHeartFilled,
} from '@tabler/icons-react';
// import { User } from 'firebase/auth';
import { Link, useNavigate } from 'react-router-dom';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Image,
  Stack,
  Text,
  useMantineTheme,
} from '@mantine/core';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthenticatedRequest } from '@/hooks/useAuthenticatedRequest';
import { useOpenSpaceImport } from '@/hooks/useOpenSpaceImport';
import { UserRef } from '@/types/users';
import { apiUrl } from '@/utils/api';
import { ItemCard } from '@/utils/itemCardQuery';
import { getTagDisplayName, getTagStyle, sortTags } from '@/utils/tagUtils';
import { trackItem } from '@/utils/trackItem';
import { ItemTypePlaceholder } from './ItemTypeIcon';
import { linkify } from '../utils/textUtils';

type ItemProps = Pick<
  ItemCard,
  | 'id'
  | 'title'
  | 'type'
  | 'author'
  | 'license'
  | 'openspaceVersion'
  | 'description'
  | 'updatedAt'
  | 'createdAt'
  | 'favoritedBy'
  | 'tags'
> & {
  image: {
    url: string;
    alt: string;
  };
  assetBundle?: { url: string; filename?: string | null; entryPath?: string | null };
};

// Tighter than the theme's button padding so Import and Download fit side by side in a narrow card
const cardButtonStyles = { root: { paddingLeft: 10, paddingRight: 10 } };

const Item: React.FC<ItemProps> = ({
  image,
  title,
  type,
  author,
  license,
  openspaceVersion,
  updatedAt,
  createdAt,
  favoritedBy,
  description,
  id,
  tags,
  assetBundle,
}) => {
  const theme = useMantineTheme();
  const [favorites, setFavorites] = useState<UserRef[]>(favoritedBy || []);
  const [isHovered, setIsHovered] = useState(false);
  const { makeRequest } = useAuthenticatedRequest();
  const navigate = useNavigate();
  const { payloadUser, showFavoriteCounts, allowImport } = useAuth();
  const isAuthor = payloadUser?.id === author?.id;
  const { importToOpenSpace } = useOpenSpaceImport();

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

  const isFavorited = favorites.some((f) => f.id === payloadUser?.id);

  return (
    <Card
      shadow="sm"
      padding="md"
      radius={12}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--hub-color-card)',
        color: 'var(--hub-color-heading)',
        border: '1px solid rgba(162, 231, 251, 0.12)',
      }}
    >
      <Card.Section pos="relative">
        <Link to={`/items/${id}`} style={{ display: 'block' }}>
          {image.url ? (
            <Image
              src={apiUrl(image.url)}
              alt={image.alt}
              height={140}
              fit="cover"
              loading="lazy"
            />
          ) : (
            <ItemTypePlaceholder type={type} height={140} iconSize={56} />
          )}
        </Link>
        <Group justify="space-between" pos="absolute" top={8} right={8}>
          {isAuthor && (
            <ActionIcon
              variant="filled"
              color="var(--mantine-color-blue-5)"
              onClick={() => navigate(`/items/${id}/edit`)}
              onFocus={() => setIsHovered(true)}
              onBlur={() => setIsHovered(false)}
              style={{
                opacity: isHovered ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              <IconEdit size={16} />
            </ActionIcon>
          )}
          <Group gap={4} style={{ position: 'relative' }}>
            <ActionIcon
              variant="filled"
              color={isFavorited ? theme.colors.red[7] : 'gray'}
              onClick={handleFavorite}
              onFocus={() => setIsHovered(true)}
              onBlur={() => setIsHovered(false)}
              style={{
                // Without counts, the heart only shows once the viewer has favorited it (or on hover),
                // so it doesn't give away that other people did
                opacity: (showFavoriteCounts && favorites.length > 0) || isFavorited || isHovered ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}
            >
              {isFavorited ? <IconHeartFilled size={16} /> : <IconHeart size={16} />}
            </ActionIcon>
            {showFavoriteCounts && favorites.length > 0 && (
              <Text
                size="xs"
                style={{
                  position: 'absolute',
                  bottom: -4,
                  right: -4,
                  backgroundColor: 'var(--hub-color-card)',
                  padding: '2px 4px',
                  borderRadius: '10px',
                  border: '1px solid var(--hub-color-border)',
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
        </Group>
      </Card.Section>

      <Stack gap="xs" p="md">
        <Group justify="space-between" align="flex-start">
          <div style={{ height: '2em', display: 'flex', alignItems: 'center' }}>
            <Text
              component={Link}
              to={`/items/${id}`}
              fw={500}
              size="sm"
              lineClamp={2}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              {title}
            </Text>
          </div>
        </Group>


        <div style={{ height: '2em', display: 'flex', alignItems: 'center' }}>
        <Text
          size="xs"
          c="light-dark(var(--mantine-color-gray-7), var(--mantine-color-gray-4))"
          lineClamp={2}
        >
          {linkify(description)}
        </Text>
        </div>
        

        <Group gap="xs" wrap="wrap">
          <Text size="xs" c="light-dark(var(--mantine-color-dark-3), var(--mantine-color-gray-4))">
            <span style={{ fontWeight: 500 }}>Author:</span>{' '}
            <Anchor component={Link} to={`/profile/${author.id}`} size="xs">
              {author.username}
            </Anchor>
          </Text>
        </Group>

        {tags && tags.length > 0 && (
          <Group gap="xs" wrap="wrap">
            {sortTags(tags).map((tag) => (
              <Badge key={tag.id} style={getTagStyle(tag.type)} size="xs">
                {getTagDisplayName(tag)}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>

      

      <Group mt="auto" pt="xs" px="md" pb="xs" gap="xs">
        {/* Import and Download never wrap apart; if the card is too narrow, Details drops below */}
        <Group gap="xs" wrap="nowrap">
        {allowImport && (
        <Button
          variant="outline"
          size="xs"
          styles={cardButtonStyles}
          leftSection={<IconFileImport size={12} />}
          onClick={() => {
            if (assetBundle?.url) {
              importToOpenSpace(
                apiUrl(assetBundle.url),
                type,
                assetBundle.filename,
                assetBundle.entryPath,
                id
              );
            }
          }}
        >
          Import
        </Button>
        )}

        <Button
          component="a"
          href={assetBundle?.url ? apiUrl(assetBundle.url) : undefined}
          download={assetBundle?.filename || true}
          variant="outline"
          size="xs"
          styles={cardButtonStyles}
          leftSection={<IconDownload size={12} />}
          disabled={!assetBundle?.url}
          onClick={() => trackItem(id, 'download')}
        >
          Download
        </Button>
        </Group>

        <Anchor component={Link} to={`/items/${id}`} size="xs" style={{ marginLeft: 'auto' }}>
          Details
        </Anchor>
      </Group>
    </Card>
  );
};

export default Item;
