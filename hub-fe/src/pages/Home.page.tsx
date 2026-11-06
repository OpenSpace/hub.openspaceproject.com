import { Container } from '@mantine/core';
import ItemGallery from '../components/ItemGallery';
import { useItems } from '../hooks/useItems';

export function HomePage() {
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
  } = useItems();

  return (
    <Container size="xl" py="md">
      <ItemGallery
        items={items}
        loading={loading}
        error={error}
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
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
