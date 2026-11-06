import { User } from './users';

interface AssetBundle {
  createdAt?: string;
  updatedAt?: string;
  title?: string;
  filename?: string;
  filesize?: number;
  entryPath?: string;
  mimeType?: string;
  url?: string;
  id: string;
}

interface Version {
  id: string;
  version: string;
  createdAt: string;
  createdBy: User;
  snapshot: {
    title: string;
    description: string;
    type: string;
    license: string;
    openspaceVersion: string;
    image: {
      id: string;
      url?: string;
    };
    assetBundle: AssetBundle;
  };
  changedFields: Array<{ field: string }>;
}

interface Tag {
  id: string;
  name: string;
  type: string;
}

interface Item {
  id: string;
  title: string;
  description: string;
  type: string;
  state: string;
  license: string;
  openspaceVersion: string;
  createdAt: Date;
  updatedAt: Date;
  author: User;
  tags: Tag[];
  assetBundle?: AssetBundle;
  image: {
    id: string;
    url?: string;
    alt?: string;
  };
  currentVersion?: Version;
  archives?: Version[];
  favoritedBy?: User[] | null;
  downloadCount?: number | null;
  importCount?: number | null;
}

export type { Version, Tag, Item };
