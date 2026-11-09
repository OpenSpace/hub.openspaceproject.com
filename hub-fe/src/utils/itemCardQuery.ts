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
