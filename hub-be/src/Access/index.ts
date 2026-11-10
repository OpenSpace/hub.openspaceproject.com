import {
  Access,
  CollectionBeforeChangeHook,
  Field,
  FieldAccess,
  Payload,
  PayloadRequest,
  ValidationError,
  ValidationFieldError,
  Where,
} from 'payload'
import { idOf } from '@/accounts/userData'

export const isAdmin: Access = ({ req: { user } }) => {
  // Return true or false based on if the user has an admin role
  return Boolean(user?.role?.includes('admin'))
}

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => {
  // Return true or false based on if the user has an admin role
  return Boolean(user?.role?.includes('admin'))
}
export const isAdminOrSelfFieldLevel: FieldAccess = ({ req: { user }, id, doc }) => {
  // Need to be logged in
  if (!user) {
    return false
  }
  // If user has role of 'admin'
  if (user.role?.includes('admin')) {
    return true
  }
  // `id` isn't passed when reading lists or populated relationships, so fall back to the doc's
  return user.id === (id ?? doc?.id)
}

export const isAdminOrSelf: Access = ({ req: { user } }) => {
  // Need to be logged in
  if (user) {
    // If user has role of 'admin'
    if (user.role?.includes('admin')) {
      return true
    }

    // If any other type of user, only provide access to themselves
    return {
      id: {
        equals: user.id,
      },
    }
  }

  // Reject everyone else
  return false
}

export const isAdminOrAuthor: Access = ({ req: { user } }) => {
  // Need to be logged in
  if (user) {
    // If user has role of 'admin'
    if (user.role?.includes('admin')) {
      return true
    }

    // Otherwise, only provide access to items they authored
    return {
      author: {
        equals: user.id,
      },
    }
  }

  // Reject everyone else
  return false
}

export const isLoggedIn: Access = ({ req: { user } }) => {
  // Return true if user is logged in, false if not
  return Boolean(user)
}

export const UPLOADS_DISABLED_MESSAGE = 'Uploading is currently disabled'

// A boolean switch in the site-config global; on unless it is explicitly false
const siteConfigSwitch = async (payload: Payload, key: 'upload' | 'signin'): Promise<boolean> => {
  const siteConfig = await payload.findGlobal({ slug: 'site-config', depth: 0 })
  return siteConfig[key] !== false
}

export const uploadsEnabled = (payload: Payload) => siteConfigSwitch(payload, 'upload')

export const SIGNIN_DISABLED_MESSAGE = 'Login and sign up are currently disabled'

// Whether new logins may register or claim a Hub account (existing sessions keep working)
export const signinEnabled = (payload: Payload) => siteConfigSwitch(payload, 'signin')

// Whether this request may upload: logged in, and uploads switched on (admins always may)
export const canUploadRequest = async (req: PayloadRequest): Promise<boolean> => {
  if (!req.user) {
    return false
  }
  if (req.user.role?.includes('admin')) {
    return true
  }
  return uploadsEnabled(req.payload)
}

// Create access for anything that adds uploaded content (items, media, asset bundles)
export const canUpload: Access = ({ req }) => canUploadRequest(req)

type RequestUser = PayloadRequest['user']

// Items a non-admin can read: published ones, plus their own in any state
const readableItems = (user: RequestUser): Where =>
  user
    ? { or: [{ state: { equals: 'published' } }, { author: { equals: user.id } }] }
    : { state: { equals: 'published' } }

// Versions of the items a non-admin can read
const readableVersions = (user: RequestUser): Where =>
  user
    ? { or: [{ 'item.state': { equals: 'published' } }, { 'item.author': { equals: user.id } }] }
    : { 'item.state': { equals: 'published' } }

export const readPublishedOrOwn: Access = ({ req: { user } }) =>
  user?.role?.includes('admin') ? true : readableItems(user)

export const readVersionsOfReadableItems: Access = ({ req: { user } }) =>
  user?.role?.includes('admin') ? true : readableVersions(user)

// Reverse links from an uploaded file to what uses it, which the read rule below queries.
// Only admins see them (as "used by" lists in the admin panel)
export const fileUsageFields = (
  itemField: 'image' | 'assetBundle',
  { profiles }: { profiles: boolean },
): Field[] => [
  {
    name: 'usedByItems',
    type: 'join',
    collection: 'items',
    on: itemField,
    access: { read: isAdminFieldLevel },
  },
  {
    name: 'usedByVersions',
    type: 'join',
    collection: 'versions',
    on: `snapshot.${itemField}`,
    access: { read: isAdminFieldLevel },
  },
  ...(profiles
    ? [
        {
          name: 'usedByUsers',
          type: 'join',
          collection: 'users',
          on: 'thumbnail',
          access: { read: isAdminFieldLevel },
        } satisfies Field,
      ]
    : []),
]

// Uploaded files (and their URLs) can be read by their uploader, and by anyone who can read an
// item or version that uses them, so files of draft or archived items aren't public.
// Profile pictures are public like the profiles
export const readUsedOrOwnFiles =
  ({ profiles }: { profiles: boolean }): Access =>
  ({ req: { user } }) => {
    if (user?.role?.includes('admin')) {
      return true
    }
    const conditions: Where[] = [
      { usedByItems: { contains: readableItems(user) } },
      { usedByVersions: { contains: readableVersions(user) } },
    ]
    if (profiles) {
      conditions.push({ usedByUsers: { contains: { thumbnail: { exists: true } } } })
    }
    if (user) {
      conditions.push({ prefix: { equals: user.id } })
    }
    return { or: conditions }
  }

// Non-admins may only attach files they uploaded themselves; otherwise anyone could make an
// unpublished file public by putting it on their own published item or profile
export const requireOwnUploads =
  (fields: Record<string, 'media' | 'asset-bundles'>): CollectionBeforeChangeHook =>
  async ({ collection, data, originalDoc, req }) => {
    const { user } = req
    if (!user || user.role?.includes('admin')) {
      return data
    }
    const errors: ValidationFieldError[] = []
    for (const [field, uploadCollection] of Object.entries(fields)) {
      const id = idOf(data[field])
      if (!id || id === idOf(originalDoc?.[field])) {
        continue
      }
      const file = await req.payload.findByID({
        collection: uploadCollection,
        id,
        depth: 0,
        disableErrors: true,
        req,
      })
      if (file?.prefix !== user.id) {
        errors.push({ path: field, message: 'You can only use files you uploaded yourself' })
      }
    }
    if (errors.length) {
      throw new ValidationError({ collection: collection.slug, errors, req })
    }
    return data
  }
