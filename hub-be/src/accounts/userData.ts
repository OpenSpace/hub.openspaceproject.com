import fsPromises from 'fs/promises'
import { firebaseAuth } from './firebase'
import type {
  CollectionAfterDeleteHook,
  CollectionBeforeDeleteHook,
  PayloadHandler,
  PayloadRequest,
} from 'payload'
import { MEDIA_DIR, storageRoot, storedFilePath, UPLOADS_DIR } from '@/storage/userFolders'

// GDPR support: deleting an item or an account takes everything that belongs to it with it,
// and users can download what the Hub holds about them

export const idOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : (value as { id?: string } | null)?.id ?? undefined

type FileCollection = 'media' | 'asset-bundles'

// Whether any item, version or (other) user still points at an uploaded file
const isFileInUse = async (
  collection: FileCollection,
  fileId: string,
  req: PayloadRequest,
  exceptUser?: string,
): Promise<boolean> => {
  const { payload } = req
  const field = collection === 'media' ? 'image' : 'assetBundle'
  const counts = await Promise.all([
    payload.count({ collection: 'items', where: { [field]: { equals: fileId } }, req }),
    payload.count({
      collection: 'versions',
      where: { [`snapshot.${field}`]: { equals: fileId } },
      req,
    }),
    collection === 'media'
      ? payload.count({
          collection: 'users',
          where: {
            thumbnail: { equals: fileId },
            ...(exceptUser ? { id: { not_equals: exceptUser } } : {}),
          },
          req,
        })
      : { totalDocs: 0 },
  ])
  return counts.some(({ totalDocs }) => totalDocs > 0)
}

// Delete uploaded files (the doc and the file on disk) that nothing else uses any more
export const deleteUnusedFiles = async (
  collection: FileCollection,
  fileIds: Iterable<string>,
  req: PayloadRequest,
  exceptUser?: string,
) => {
  for (const fileId of fileIds) {
    try {
      if (!(await isFileInUse(collection, fileId, req, exceptUser))) {
        await req.payload.delete({ collection, id: fileId, req })
      }
    } catch (err) {
      // e.g. the doc is already gone; one bad file shouldn't stop the rest
      req.payload.logger.error(`Could not delete ${collection} ${fileId}: ${(err as Error).message}`)
    }
  }
}

// Items afterDelete: remove the item's versions and its files (current and archived) unless
// another item uses them
export const deleteItemData: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const { payload } = req
  const media = new Set<string>()
  const bundles = new Set<string>()
  const add = (set: Set<string>, value: unknown) => {
    const id = idOf(value)
    if (id) set.add(id)
  }
  add(media, doc.image)
  add(bundles, doc.assetBundle)

  const versions = await payload.find({
    collection: 'versions',
    where: { item: { equals: doc.id } },
    pagination: false,
    depth: 0,
    req,
  })
  for (const version of versions.docs) {
    add(media, version.snapshot?.image)
    add(bundles, version.snapshot?.assetBundle)
  }
  if (versions.docs.length) {
    await payload.delete({ collection: 'versions', where: { item: { equals: doc.id } }, req })
  }

  await deleteUnusedFiles('media', media, req)
  await deleteUnusedFiles('asset-bundles', bundles, req)
}

// Users beforeDelete: erase everything the account owns before the user doc goes.
// The Firebase login is left alone: the Firebase project is shared with the Astrocasting app,
// so deleting it would delete their Astrocasting login too
export const deleteUserContent: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const { payload } = req
  const userId = String(id)
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 0, req })

  // Their items, with versions and files (see deleteItemData)
  const items = await payload.delete({ collection: 'items', where: { author: { equals: userId } }, req })
  if (items.errors.length) {
    throw new Error(`Could not delete the user's items: ${items.errors.map((e) => e.message).join('; ')}`)
  }

  // Their favorites on other people's items, atomically like the /favorite endpoint
  await payload.db.collections['items'].updateMany(
    { favoritedBy: userId },
    { $pull: { favoritedBy: userId }, $inc: { favoritesCount: -1 } },
    { timestamps: false },
  )

  // Anything else they uploaded (profile picture, files never attached to an item), unless
  // someone else's item still uses it
  for (const collection of ['media', 'asset-bundles'] as const) {
    const uploads = await payload.find({
      collection,
      where: { prefix: { equals: userId } },
      pagination: false,
      depth: 0,
      req,
    })
    const ids = new Set(uploads.docs.map((doc) => doc.id))
    if (collection === 'media') {
      const thumbnail = idOf(user.thumbnail)
      if (thumbnail) ids.add(thumbnail)
    }
    await deleteUnusedFiles(collection, ids, req, userId)
  }

  // Their upload folders, if now empty (rmdir refuses non-empty ones, e.g. a file someone
  // else's item still uses)
  for (const [dir, slug] of [
    [UPLOADS_DIR, 'asset-bundles'],
    [MEDIA_DIR, 'media'],
  ]) {
    await fsPromises.rmdir(storedFilePath(storageRoot(dir, slug), userId, '')).catch(() => {})
  }
}

const fileInfo = (file: unknown) => {
  if (!file || typeof file !== 'object') return idOf(file) ?? null
  const { filename, url, filesize, mimeType } = file as Record<string, unknown>
  return { filename, url, filesize, mimeType }
}

// GET /api/users/me/export: everything the Hub holds about the logged-in user, as JSON
export const exportUserData: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'You must be logged in' }, { status: 401 })
  }
  const { payload } = req
  const userId = req.user.id
  const user = await payload.findByID({ collection: 'users', id: userId, depth: 1, req })

  let signIn: unknown = null
  if (user.firebaseUID) {
    try {
      const firebaseUser = await firebaseAuth().getUser(user.firebaseUID)
      signIn = {
        firebaseUID: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        providers: firebaseUser.providerData.map(({ providerId, email, displayName }) => ({
          providerId,
          email,
          displayName,
        })),
        createdAt: firebaseUser.metadata.creationTime,
        lastSignIn: firebaseUser.metadata.lastSignInTime,
      }
    } catch (err) {
      payload.logger.error(`Could not read Firebase user for export: ${(err as Error).message}`)
    }
  }

  const items = await payload.find({
    collection: 'items',
    where: { author: { equals: userId } },
    pagination: false,
    depth: 1,
    req,
  })
  const versions = await payload.find({
    collection: 'versions',
    where: { item: { in: items.docs.map((item) => item.id) } },
    pagination: false,
    depth: 1,
    sort: 'createdAt',
    req,
  })
  // Only favorites the user can still see (published, or their own)
  const favorites = await payload.find({
    collection: 'items',
    where: { favoritedBy: { in: [userId] } },
    pagination: false,
    depth: 0,
    select: { title: true },
    overrideAccess: false,
    req,
  })

  const data = {
    exportedAt: new Date().toISOString(),
    profile: {
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      institution: user.institution,
      link: user.link,
      contactEmail: user.contactEmail,
      slackHandle: user.slackHandle,
      role: user.role,
      thumbnail: fileInfo(user.thumbnail),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    signIn,
    items: items.docs.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      type: item.type,
      state: item.state,
      license: item.license,
      openspaceVersion: item.openspaceVersion,
      tags: (item.tags ?? []).map((tag) => (typeof tag === 'string' ? tag : tag.name)),
      image: fileInfo(item.image),
      file: fileInfo(item.assetBundle),
      favoritesCount: item.favoritesCount,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
      versions: versions.docs
        .filter((version) => idOf(version.item) === item.id)
        .map((version) => ({
          version: version.version,
          createdAt: version.createdAt,
          changedFields: (version.changedFields ?? []).map(({ field }) => field),
          snapshot: {
            ...version.snapshot,
            image: fileInfo(version.snapshot?.image),
            assetBundle: fileInfo(version.snapshot?.assetBundle),
          },
        })),
    })),
    favorites: favorites.docs.map((item) => ({ id: item.id, title: item.title })),
  }

  return Response.json(data, {
    headers: { 'Content-Disposition': 'attachment; filename="openspace-hub-data.json"' },
  })
}
