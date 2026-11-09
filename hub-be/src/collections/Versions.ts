import { isAdmin, readVersionsOfReadableItems } from '@/Access'
import { ITEM_TYPES } from '@/itemTypes'
import { normalizeOpenspaceVersion } from '@/validation/openspaceVersion'
import type { CollectionConfig, Field } from 'payload'

// Copies of item values, which were checked against the site config when the item was saved.
// Checking them again would fail for options since taken off the site config lists
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
    options: [...ITEM_TYPES],
  },
  {
    name: 'license',
    type: 'text',
  },
  {
    name: 'openspaceVersion',
    type: 'text',
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
