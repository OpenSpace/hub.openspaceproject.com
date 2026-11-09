import { isAdmin, readVersionsOfReadableItems } from '@/Access'
import { normalizeOpenspaceVersion, validateOpenspaceVersion } from '@/validation/openspaceVersion'
import type { CollectionConfig, Field } from 'payload'

// Define the version snapshot structure
const VersionSnapshot: Field[] = [
  {
    name: 'title',
    type: 'text',
  },
  {
    name: 'description',
    type: 'text',
  },
  {
    name: 'type',
    type: 'select',
    options: ['asset', 'profile', 'recording', 'webpanel', 'config', 'showcomposer', 'package'],
  },
  {
    name: 'license',
    type: 'select',
    options: [
      'CC BY',
      'CC BY-SA',
      'CC BY-NC',
      'CC BY-NC-SA',
      'CC BY-ND',
      'CC BY-NC-ND',
      'CC0',
      'MIT',
      'Apache',
      'GPL',
      'LGPL',
      'BSD',
      'Proprietary',
    ],
  },
  {
    name: 'openspaceVersion',
    type: 'text',
    validate: validateOpenspaceVersion,
    hooks: { beforeValidate: [normalizeOpenspaceVersion] },
  },
  {
    name: 'image',
    type: 'upload',
    relationTo: 'media',
  },
  {
    name: 'assetBundle',
    type: 'upload',
    relationTo: 'asset-bundles',
  },
]

export const Versions: CollectionConfig = {
  slug: 'versions',
  access: {
    read: readVersionsOfReadableItems,
    create: isAdmin, // Item hooks make versions through the local API, which skips this
    update: isAdmin, // Versions should be immutable
    delete:  isAdmin, // Versions should be immutable
  },
  fields: [
    {
      name: 'item',
      type: 'relationship',
      relationTo: 'items',
      required: false,
      hasMany: false,
    },
    {
      name: 'version',
      type: 'text',
      required: true,
    },
    {
      name: 'createdAt',
      type: 'date',
      required: true,
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'snapshot',
      type: 'group',
      fields: VersionSnapshot,
    },
    {
      name: 'changedFields',
      type: 'array',
      fields: [
        {
          name: 'field',
          type: 'text',
        }
      ],
    },
  ],
}
