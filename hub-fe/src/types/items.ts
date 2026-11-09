import type { Item, Tag, Version } from '@payload-types';

export type { AssetBundle, Item, Tag, Version } from '@payload-types';

// A relationship field holds the related doc's id at depth 0, and the doc once populated
type PopulatedField<V> = V extends readonly (infer E)[] ? Exclude<E, string>[] : Exclude<V, string>;

// T as loaded with depth >= 1: the relationship fields K hold docs instead of ids
export type Populated<T, K extends keyof T> = Omit<T, K> & { [P in K]: PopulatedField<T[P]> };

export type TagRef = Pick<Tag, 'id' | 'name' | 'type'>;

// A version loaded through its item at depth 2, so its snapshot's files are loaded too
export type VersionWithFiles = Omit<Version, 'snapshot'> & {
  snapshot?: Populated<NonNullable<Version['snapshot']>, 'image' | 'assetBundle'>;
};

// An item from GET /api/items/:id (Payload's default depth 2)
export type ItemDetail = Omit<
  Populated<Item, 'author' | 'tags' | 'favoritedBy' | 'image' | 'assetBundle'>,
  'currentVersion' | 'archives'
> & {
  currentVersion?: VersionWithFiles | null;
  archives?: VersionWithFiles[] | null;
};
