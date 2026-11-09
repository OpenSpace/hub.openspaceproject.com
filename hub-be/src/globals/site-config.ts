import { GlobalConfig } from 'payload'
import { ITEM_TYPES } from '@/itemTypes'

// Switches count as on when unset (allowImport as off), as in configs saved before they existed
export const SiteConfig: GlobalConfig = {
  slug: 'site-config',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'upload',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Let users upload new items and files. Admins always can.' },
    },
    {
      name: 'signin',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Let people log in and sign up. Signed-in users stay signed in.' },
    },
    {
      name: 'showFavoriteCounts',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Show the number of favorites next to the hearts.' },
    },
    {
      name: 'showDownloadCounts',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Show the download count on item pages.' },
    },
    {
      name: 'allowImport',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Show the Import to OpenSpace buttons.' },
    },
    {
      name: 'versions',
      label: 'OpenSpace versions',
      type: 'text',
      hasMany: true,
      required: true,
      admin: { description: 'Minor versions only (e.g. 0.21), in the order the upload form lists them.' },
    },
    {
      name: 'itemTypes',
      type: 'select',
      options: [...ITEM_TYPES],
      hasMany: true,
      required: true,
      admin: { description: 'The types that can be uploaded.' },
    },
    {
      name: 'licenses',
      type: 'text',
      hasMany: true,
      required: true,
      admin: { description: 'In the order the upload form lists them.' },
    },
  ],
}
