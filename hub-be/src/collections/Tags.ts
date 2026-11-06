import type { CollectionConfig } from 'payload'
import { isAdmin } from '@/Access'

export const Tags: CollectionConfig = {
  slug: 'tags',
  access: {
    read: () => true,
    // Item hooks make the tags they need through the local API, which skips these
    update: isAdmin,
    delete: isAdmin,
    create: isAdmin,
  },
  admin: {
    useAsTitle: 'name',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [
        'itemType',
        'openspaceVersion',
        'license',
        'custom'
      ],
      required: true,
      defaultValue: 'custom'
    },
    // {
    //   name: 'description',
    //   type: 'text',
    //   //   required: true,
    // },
  ],
}
