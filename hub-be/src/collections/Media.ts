import type { CollectionConfig } from 'payload'
import { canUpload, fileUsageFields, isAdmin, readUsedOrOwnFiles } from '@/Access'
import { MEDIA_DIR, setUserFolder, userFolderField } from '@/storage/userFolders'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: readUsedOrOwnFiles({ profiles: true }),
    create: canUpload,
    // Files are only replaced or removed through their item (or by admins); Payload's default
    // would let any logged-in user change or delete anyone's files
    update: isAdmin,
    delete: isAdmin,
  },
  // What items and profiles show of their image; also skips the usedBy* lookups there
  defaultPopulate: {
    alt: true,
    url: true,
    thumbnailURL: true,
    filename: true,
    mimeType: true,
    filesize: true,
    width: true,
    height: true,
    updatedAt: true,
    createdAt: true,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
    },
    userFolderField,
    ...fileUsageFields('image', { profiles: true }),
  ],
  hooks: {
    beforeChange: [setUserFolder],
  },
  upload: {
    staticDir: MEDIA_DIR,
    mimeTypes: ['image/*'],
    // Users often upload huge PNG screenshots. Shrink the stored original to fit within
    // 1920x1920 (never enlarging) and re-encode it as WebP, which keeps PNG transparency
    // (JPEG would turn it black) while being far smaller
    resizeOptions: {
      width: 1920,
      height: 1920,
      fit: 'inside',
      withoutEnlargement: true,
    },
    formatOptions: {
      format: 'webp',
      options: { quality: 82 },
    },
  },
}
