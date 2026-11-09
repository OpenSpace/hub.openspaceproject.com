import { useCallback, useEffect, useMemo, useState } from 'react';
import debounce from 'lodash.debounce';
import { stringify } from 'qs-esm';
import { useSearchParams } from 'react-router-dom';
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

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'oldest', label: 'Oldest First' },
  { value: 'title', label: 'Title A-Z' },
  { value: 'mostFavorited', label: 'Most Favorited' },
];

// Tags are Mongo documents, so their ids are ObjectIds
const TAG_ID = /^[0-9a-f]{24}$/i;

interface UseItemsOptions {
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
  limit = 12,
  additionalWhere = {},
  initialSort = 'newest',
}: UseItemsOptions = {}): UseItemsReturn {
  const [items, setItems] = useState<ItemCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [tagFacets, setTagFacets] = useState<TagFacet[]>([]);

  // The filters live in the URL (?q=&sort=&tag=&tag=&page=), so reloading, the back button
  // and shared links keep them. Defaults are left out of the URL
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort');
  const sortBy =
    sortParam && SORT_OPTIONS.some((option) => option.value === sortParam)
      ? sortParam
      : initialSort;
  const currentPage = Math.max(1, Number.parseInt(searchParams.get('page') ?? '', 10) || 1);
  const tagsKey = searchParams.getAll('tag').join(',');
  const tagIds = useMemo(
    () => [...new Set(tagsKey.split(',').filter((id) => TAG_ID.test(id)))],
    [tagsKey]
  );

  // The URL only has tag ids; this holds the names and types of the ones seen so far
  const [knownTags, setKnownTags] = useState(() => new Map<string, TagRef>());
  const selectedTags = useMemo(
    () => tagIds.flatMap((id) => knownTags.get(id) ?? []),
    [tagIds, knownTags]
  );

  const updateParams = (
    changes: Record<string, string | string[] | null>,
    options: { replace?: boolean; flushSync?: boolean } = {}
  ) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        next.delete(key);
        for (const item of [value ?? []].flat()) {
          if (item) {
            next.append(key, item);
          }
        }
      }
      return next;
    }, options);
  };

  // Callers often pass a new additionalWhere object each render; key on its contents so
  // that doesn't refetch every render
  const additionalWhereKey = JSON.stringify(additionalWhere);

  // Cache for search results
  const searchCache = useMemo(() => new Map<string, PaginatedResponse>(), []);
  const facetCache = useMemo(() => new Map<string, TagFacet[]>(), []);

  // Every filter as one AND list, so they can't overwrite each other. Each selected tag is
  // its own condition: items must have all of them, so each tag clicked narrows the results
  const buildWhere = useCallback(
    (search: string, tags: string[]) => {
      const conditions: Record<string, any>[] = [];
      if (search) {
        conditions.push({
          or: [{ title: { contains: search } }, { description: { contains: search } }],
        });
      }
      for (const tag of tags) {
        conditions.push({ tags: { equals: tag } });
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
    async (search: string, tags: string[]) => {
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
    async (page: number, search: string, sort: string, tags: string[]) => {
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
        const cacheKey = JSON.stringify(query);

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
    [buildWhere, limit, searchCache]
  );

  // Debounced search handler
  const debouncedFetch = useMemo(
    () =>
      debounce((page: number, search: string, sort: string, tags: string[]) => {
        fetchItems(page, search, sort, tags);
      }, 100), // 300ms delay
    [fetchItems]
  );

  // Effect for handling search changes
  useEffect(() => {
    // Only search if query is empty or has at least 2 characters
    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      debouncedFetch(currentPage, searchQuery, sortBy, tagIds);
    }

    // Cleanup
    return () => {
      debouncedFetch.cancel();
    };
  }, [currentPage, searchQuery, sortBy, tagIds, debouncedFetch]);

  // Tag options only depend on the filters, not the page or sort order
  useEffect(() => {
    if (searchQuery.length === 0 || searchQuery.length >= 2) {
      const timeout = setTimeout(() => fetchTagFacets(searchQuery, tagIds), 100);
      return () => clearTimeout(timeout);
    }
  }, [searchQuery, tagIds, fetchTagFacets]);

  // Look up tags from the URL that haven't been seen yet, and drop ids that aren't tags
  useEffect(() => {
    const missing = tagIds.filter((id) => !knownTags.has(id));
    if (missing.length === 0) {
      return;
    }
    let cancelled = false;
    const query = stringify(
      {
        where: { id: { in: missing } },
        select: { name: true, type: true },
        depth: 0,
        pagination: false,
      },
      { addQueryPrefix: true }
    );
    apiFetch<{ docs: TagRef[] }>(`/api/tags${query}`)
      .then(({ docs }) => {
        if (cancelled) {
          return;
        }
        setKnownTags((prev) => {
          const next = new Map(prev);
          for (const { id, name, type } of docs) {
            next.set(id, { id, name, type });
          }
          return next;
        });
        const unknown = missing.filter((id) => !docs.some((tag) => tag.id === id));
        if (unknown.length > 0) {
          setSearchParams(
            (prev) => {
              const next = new URLSearchParams(prev);
              next.delete('tag');
              for (const id of prev.getAll('tag')) {
                if (!unknown.includes(id)) {
                  next.append('tag', id);
                }
              }
              return next;
            },
            { replace: true }
          );
        }
      })
      .catch((err) => console.error('Error looking up tags:', err));
    return () => {
      cancelled = true;
    };
  }, [tagIds, knownTags, setSearchParams]);

  const handlePageChange = (page: number) => {
    updateParams({ page: page > 1 ? String(page) : null });
  };

  // Typing replaces the history entry, so Back skips the search's intermediate states.
  // flushSync keeps the controlled search box from losing keystrokes to a transition
  const handleSearch = (query: string) => {
    updateParams({ q: query, page: null }, { replace: searchQuery !== '', flushSync: true });
  };

  const handleSort = (sort: string) => {
    updateParams({ sort: sort === initialSort ? null : sort, page: null });
  };

  const handleTagSelect = (tag: TagRef) => {
    setKnownTags((prev) => new Map(prev).set(tag.id, tag));
    if (!tagIds.includes(tag.id)) {
      updateParams({ tag: [...tagIds, tag.id], page: null });
    }
  };

  const handleTagRemove = (tagId: string) => {
    updateParams({ tag: tagIds.filter((id) => id !== tagId), page: null });
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
