import React, { useMemo, useState } from 'react';
import { IconSearch, IconTags, IconX } from '@tabler/icons-react';
import {
  Alert,
  Badge,
  Button,
  Center,
  Group,
  Loader,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core';
import { TagFacet } from '@/hooks/useItems';
import { Item as ItemType, Tag } from '@/types/items';
import { getTagDisplayName, getTagLabel, getTagStyle } from '@/utils/tagUtils';
import Item from './Item';

const TAG_GROUP_ORDER = ['itemType', 'openspaceVersion', 'license', 'custom'];
const tagGroupRank = (type: string) => {
  const rank = TAG_GROUP_ORDER.indexOf(type);
  return rank === -1 ? TAG_GROUP_ORDER.length : rank;
};

interface ItemGalleryProps {
  items?: ItemType[];
  loading?: boolean;
  error?: string | null;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSearch: (query: string) => void;
  onSort: (sort: string) => void;
  sortBy: string;
  selectedTags: Tag[];
  tagFacets: TagFacet[];
  onTagSelect: (tag: Tag) => void;
  onTagRemove: (tagId: string) => void;
}

const ItemGallery: React.FC<ItemGalleryProps> = ({
  items: propItems,
  loading: propLoading,
  error: propError,
  currentPage,
  totalPages,
  onPageChange,
  onSearch,
  onSort,
  sortBy,
  selectedTags,
  tagFacets,
  onTagSelect,
  onTagRemove,
}) => {
  const [showTags, setShowTags] = useState(false);
  const colorScheme = useMantineColorScheme();
  const theme = useMantineTheme();

  // Tags across every item matching the current filters (from the API, not just this page),
  // minus the ones already selected, grouped by type in a fixed order
  const tagGroups = useMemo(() => {
    const selectedIds = new Set(selectedTags.map((tag) => tag.id));
    const grouped = new Map<string, TagFacet[]>();
    for (const tag of tagFacets) {
      if (!selectedIds.has(tag.id)) {
        grouped.set(tag.type, [...(grouped.get(tag.type) ?? []), tag]);
      }
    }
    return [...grouped.entries()]
      .sort(([a], [b]) => tagGroupRank(a) - tagGroupRank(b))
      .map(([group, tags]) => ({ group, tags }));
  }, [tagFacets, selectedTags]);

  return (
    <Stack gap="md">
      <Stack gap="xs">
        <Group wrap="nowrap">
          <TextInput
            placeholder="Search items..."
            onChange={(e) => onSearch(e.target.value)}
            leftSection={<IconSearch size={16} />}
            w={300}
          />
          <Select
            value={sortBy}
            onChange={(value) => onSort(value || 'newest')}
            data={[
              { value: 'newest', label: 'Newest First' },
              { value: 'oldest', label: 'Oldest First' },
              { value: 'title', label: 'Title A-Z' },
              { value: 'mostFavorited', label: 'Most Favorited' },
            ]}
            w={150}
          />
          <Button
            variant="light"
            onClick={() => setShowTags(!showTags)}
            leftSection={<IconTags size={16} />}
          >
            {showTags ? 'Hide Filters' : 'Show Filters'}
          </Button>
        </Group>

        {selectedTags.length > 0 && (
          <Group gap="xs" wrap="wrap">
            {selectedTags.map((tag) => (
              <Badge
                key={tag.id}
                variant="filled"
                size="sm"
                style={{ ...getTagStyle(tag.type), cursor: 'pointer' }}
                rightSection={
                  <IconX
                    size={12}
                    style={{ marginLeft: 4 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTagRemove(tag.id);
                    }}
                  />
                }
              >
                {getTagDisplayName(tag)}
              </Badge>
            ))}
          </Group>
        )}
      </Stack>

      {showTags && (
        <Stack gap="xs">
          {tagGroups.map((group) => (
            <Group key={group.group} gap="xs" wrap="wrap">
              <Text
                size="sm"
                fw={500}
                c={colorScheme.colorScheme === 'dark' ? theme.white : theme.colors.dark[7]}
              >
                {getTagLabel(group.group as Tag['type'])}:
              </Text>
              {group.tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant="filled"
                  size="sm"
                  style={{ ...getTagStyle(tag.type), cursor: 'pointer' }}
                  onClick={() => onTagSelect({ id: tag.id, name: tag.name, type: tag.type })}
                >
                  {getTagDisplayName(tag)}
                </Badge>
              ))}
            </Group>
          ))}
          {tagGroups.length === 0 && (
            <Text
              size="sm"
              c={colorScheme.colorScheme === 'dark' ? theme.colors.gray[5] : theme.colors.dark[2]}
            >
              No more tags to filter by
            </Text>
          )}
        </Stack>
      )}

      {/* {propLoading ? (
        <Center>
          <Loader color={colorScheme.colorScheme === 'dark' ? theme.white : theme.colors.dark[7]} />
        </Center>
      ) : propError ? (
        <Alert color="red" title="Error" variant="light">
          {propError}
        </Alert>
      ) : propItems?.length === 0 ? (
        <Alert color="blue" title="No Items Found" variant="light">
          Try adjusting your search or filters
        </Alert>
      ) : ( */}
      <>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 4 }} spacing="md">
          {propItems?.map((item) => (
            <Item
              key={item.id}
              id={item.id}
              title={item.title}
              description={item.description}
              type={item.type}
              author={item.author}
              license={item.license}
              openspaceVersion={item.openspaceVersion}
              createdAt={item.createdAt}
              updatedAt={item.updatedAt}
              favoritedBy={item.favoritedBy}
              tags={item.tags}
              image={{
                url: item.image?.url || '',
                alt: item.image?.alt || item.title,
              }}
              assetBundle={{
                url: item.assetBundle?.url || '',
                filename: item.assetBundle?.filename,
                entryPath: item.assetBundle?.entryPath,
              }}
              currentVersion={item.currentVersion}
              archives={item.archives}
            />
          ))}
        </SimpleGrid>

        {/* Pagination controls */}
        <Group justify="center" mt="md" mb="md">
          <Button
            variant="light"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <Text>
            Page {currentPage} of {totalPages}
          </Text>
          <Button
            variant="light"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </Group>
      </>
      {/* )} */}
    </Stack>
  );
};

export default ItemGallery;
