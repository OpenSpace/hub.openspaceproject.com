import type { AssetBundle, Item, Media, Version } from '@payload-types';
import type { TagRef } from '@/types/items';
import type { UserRef } from '@/types/users';

// Query params for GET /api/items that load only what item cards show: the item's own links
// (depth 1), each trimmed to the fields the card uses
export const itemCardQuery = {
  depth: 1,
  select: {
    title: true,
    description: true,
    type: true,
    license: true,
    openspaceVersion: true,
    author: true,
    tags: true,
    image: true,
    assetBundle: true,
    currentVersion: true,
    archives: true,
    favoritedBy: true,
    createdAt: true,
    updatedAt: true,
  },
  populate: {
    users: { username: true },
    tags: { name: true, type: true },
    // Payload builds `url` from `filename`
    media: { url: true, alt: true, filename: true },
    'asset-bundles': { url: true, filename: true, entryPath: true },
    versions: { version: true, createdAt: true },
  },
};

// An item as itemCardQuery loads it
export type ItemCard = Pick<
  Item,
  | 'id'
  | 'title'
  | 'description'
  | 'type'
  | 'license'
  | 'openspaceVersion'
  | 'createdAt'
  | 'updatedAt'
> & {
  author: UserRef;
  tags?: TagRef[] | null;
  image?: Pick<Media, 'id' | 'url' | 'alt' | 'filename'> | null;
  assetBundle?: Pick<AssetBundle, 'id' | 'url' | 'filename' | 'entryPath'> | null;
  currentVersion?: Pick<Version, 'id' | 'version' | 'createdAt'> | null;
  archives?: Pick<Version, 'id' | 'version' | 'createdAt'>[] | null;
  favoritedBy?: UserRef[] | null;
};
