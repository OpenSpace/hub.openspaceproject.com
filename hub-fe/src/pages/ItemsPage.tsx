import { Container } from '@mantine/core';
import ItemGallery from '../components/ItemGallery';
import { useItems } from '../hooks/useItems';
import { ItemType } from '../utils/tagUtils';

export function ItemsPage({
  type,
}: {
  type: ItemType | null;
}) {
  const {
    items,
    loading,
    error,
    currentPage,
    totalPages,
    searchQuery,
    sortBy,
    selectedTags,
    tagFacets,
    handlePageChange,
    handleSearch,
    handleSort,
    handleTagSelect,
    handleTagRemove,
  } = useItems({
    additionalWhere: type ? { type: { equals: type } } : {},
  });

  return (
    <Container size="xl" py="xl">
      <ItemGallery
        items={items}
        loading={loading}
        error={error}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        searchQuery={searchQuery}
        onSearch={handleSearch}
        onSort={handleSort}
        sortBy={sortBy}
        selectedTags={selectedTags}
        tagFacets={tagFacets}
        onTagSelect={handleTagSelect}
        onTagRemove={handleTagRemove}
      />
    </Container>
  );
}
