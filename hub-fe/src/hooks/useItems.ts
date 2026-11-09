import { useCallback, useEffect, useMemo, useState } from 'react';
import debounce from 'lodash.debounce';
import { stringify } from 'qs-esm';
import { TagRef } from '@/types/items';
import { apiFetch } from '@/utils/api';
import { ItemCard, itemCardQuery } from '@/utils/itemCardQuery';

interface PaginatedResponse {
  docs: ItemCard[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  timestamp: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

// A tag used by items matching the current filters, with how many of them carry it
export interface TagFacet extends TagRef {
  count: number;
}

interface UseItemsOptions {
  initialPage?: number;
  limit?: number;
  additionalWhere?: Record<string, any>;
  initialSort?: string;
}

interface UseItemsReturn {
  items: ItemCard[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  searchQuery: string;
  sortBy: string;
  selectedTags: TagRef[];
  // Tags across all items matching the search and selected tags (not just this page)
  tagFacets: TagFacet[];
  handlePageChange: (page: number) => void;
  handleSearch: (query: string) => void;
  handleSort: (sort: string) => void;
  handleTagSelect: (tag: TagRef) => void;
  handleTagRemove: (tagId: string) => void;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useItems({
  initialPage = 1,
  limit = 12,
  additionalWhere = {},
  initialSort = 'newest',
}: UseItemsOptions = {}): UseItemsReturn {
  const [items, setItems] = useState<ItemCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState(initialSort);
  const [selectedTags, setSelectedTags] = useState<TagRef[]>([]);
  const [tagFacets, setTagFacets] = useState<TagFacet[]>([]);

  // Callers often pass a new additionalWhere object each render; key on its contents so
  // that doesn't refetch every render
  const additionalWhereKey = JSON.stringify(additionalWhere);

  // Cache for search results
  const searchCache = useMemo(() => new Map<string, PaginatedResponse>(), []);
  const facetCache = useMemo(() => new Map<string, TagFacet[]>(), []);

  // Every filter as one AND list, so they can't overwrite each other. Each selected tag is
  // its own condition: items must have all of them, so each tag clicked narrows the results
  const buildWhere = useCallback(
    (search: string, tags: TagRef[]) => {
      const conditions: Record<string, any>[] = [];
      if (search) {
        conditions.push({
          or: [{ title: { contains: search } }, { description: { contains: search } }],
        });
      }
      for (const tag of tags) {
        conditions.push({ tags: { equals: tag.id } });
      }
      const extra = JSON.parse(additionalWhereKey);
      if (Object.keys(extra).length > 0) {
        conditions.push(extra);
      }
      return conditions.length > 0 ? { and: conditions } : {};
    },
    [additionalWhereKey]
  );

  const fetchTagFacets = useCallback(
    async (search: string, tags: TagRef[]) => {
      const where = buildWhere(search, tags);
      const cacheKey = JSON.stringify(where);
      const cached = facetCache.get(cacheKey);
      if (cached) {
        setTagFacets(cached);
        return;
      }
      try {
        const data = await apiFetch<{ tags: TagFacet[] }>(
          `/api/items/tag-facets${stringify({ where }, { addQueryPrefix: true })}`
        );
        facetCache.set(cacheKey, data.tags);
        setTagFacets(data.tags);
      } catch (err) {
        // The item list still works without tag options, so just log it
        console.error('Error fetching tag facets:', err);
        setTagFacets([]);
      }
    },
    [buildWhere, facetCache]
  );

  const fetchItems = useCallback(
    async (page: number, search: string = '', sort: string = initialSort, tags: TagRef[] = []) => {
      try {
        setLoading(true);

        const where = buildWhere(search, tags);

        // Build the sort clause
        const sortClause =
          sort === 'title'
            ? 'titleLower'
            : sort === 'oldest'
              ? 'createdAt'
              : sort === 'mostFavorited'
                ? '-favoritesCount'
                : '-createdAt';

        // Build the query object
        const query = {
          ...itemCardQuery,
          where,
          sort: sortClause,
          limit,
          page,
        };

        // Create cache key
        const cacheKey = JSON.stringify({ query, tags: tags.map((t) => t.id) });

        // Check cache first
        const cachedData = searchCache.get(cacheKey);
        if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
          setItems(cachedData.docs);
          setTotalPages(cachedData.totalPages);
          setError(null);
          setLoading(false);
          return;
        } else {
          searchCache.delete(cacheKey);
        }

        // Convert query object to query string using qs-esm
        const stringifiedQuery = stringify(query, { addQueryPrefix: true });

        const data = await apiFetch<PaginatedResponse>(`/api/items${stringifiedQuery}`);

        // Cache the results
        searchCache.set(cacheKey, {
          ...data,
          timestamp: Date.now(),
        });

        setItems(data.docs);
        setTotalPages(data.totalPages);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    },
    [buildWhere, initialSort, limit, searchCache]
  );

  // Debounced search handler
  const debouncedFetch = useMemo(
    () =>
      debounce((page: number, search: string, sort: string, tags: TagRef[]) => {
        fetchItems(page, search, sort, tags);
      }, 100), // 300ms delay
    [fetchItems]
  );

  // Effect for handling search changes
  useEffect(() => {
    // Only search if query is empty or has at least 2 characters
    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      debouncedFetch(currentPage, searchQuery, sortBy, selectedTags);
    }

    // Cleanup
    return () => {
      debouncedFetch.cancel();
    };
  }, [currentPage, searchQuery, sortBy, selectedTags, debouncedFetch]);

  // Tag options only depend on the filters, not the page or sort order
  useEffect(() => {
    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      const timeout = setTimeout(() => fetchTagFacets(searchQuery, selectedTags), 100);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery, selectedTags, fetchTagFacets]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleSort = (sort: string) => {
    setSortBy(sort);
    setCurrentPage(1); // Reset to first page when sorting changes
  };

  const handleTagSelect = (tag: TagRef) => {
    if (!selectedTags.some((t) => t.id === tag.id)) {
      setSelectedTags((prev) => [...prev, tag]);
      setCurrentPage(1); // Reset to first page when adding a tag
    }
  };

  const handleTagRemove = (tagId: string) => {
    setSelectedTags((prev) => prev.filter((tag) => tag.id !== tagId));
    setCurrentPage(1); // Reset to first page when removing a tag
  };

  return {
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
  };
}
