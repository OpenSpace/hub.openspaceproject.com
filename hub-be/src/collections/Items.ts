import { deleteItemData } from '@/accounts/userData'
import { canUpload, isAdminFieldLevel, isAdminOrAuthor, readPublishedOrOwn } from '@/Access'
import { Item, User } from '@/payload-types'
import { validateOpenspaceVersion } from '@/validation/openspaceVersion'
import { withCors } from '@/withCors'
import type { CollectionConfig, PayloadRequest, Where } from 'payload'

// Helper function to track changed fields
function getChangedFields(originalDoc: any, newData: any): { field: string }[] {
  const fields = ['title', 'description', 'type', 'license', 'openspaceVersion', 'image', 'assetBundle']
  return fields
    .filter(field => originalDoc[field] !== newData[field])
    .map(field => ({ field }))
}

// When an address last counted a download/import of an item, for the /track endpoint's
// repeat-click limit. In memory only, so it resets on restart
const TRACK_WINDOW_MS = 60_000
const trackedRecently = new Map<string, number>()

export const Items: CollectionConfig = {
  slug: 'items',
  access: {
    read: readPublishedOrOwn,
    create: canUpload,
    update: isAdminOrAuthor,
    delete: isAdminOrAuthor,
  },
  admin: {
    useAsTitle: 'title',
  },
  hooks: {
    beforeChange: [
      async ({ req, data, originalDoc, operation, context }) => {
        // Keep the denormalized favorites count in sync whenever favoritedBy changes,
        // so "Most Favorited" sorting can use a simple indexed field instead of
        // sorting by relationship array length (which Mongo can't do directly).
        if (data?.favoritedBy !== undefined) {
          data.favoritesCount = Array.isArray(data.favoritedBy) ? data.favoritedBy.length : 0
        }

        // Keep a lowercased copy of the title in sync so "Title A-Z" sorting can
        // be case-insensitive - Mongo's default sort is byte-order (case-sensitive),
        // and Payload doesn't expose a collation option to sort around that.
        if (typeof data?.title === 'string') {
          data.titleLower = data.title.toLowerCase()
        }

        // Don't trust the author sent by the client: a non-admin's new item is always their
        // own, and only admins can move an item to another author
        if (req.user && !req.user.role?.includes('admin')) {
          if (operation === 'create') {
            data.author = req.user.id
          } else {
            // `data` holds the whole doc here, so put the stored author back rather than
            // deleting the field (which would fail as missing)
            const author = originalDoc?.author
            data.author = typeof author === 'object' && author ? author.id : author
          }
        }

        // return data;
        if (!req.user || context?.skipItemHooks) {
          return data
        }

        // Version management only applies to edits of an existing item.
        // Note: Payload passes originalDoc as `{}` (not undefined) on create,
        // so this must be gated on `operation`, not on originalDoc truthiness.
        if (operation === 'update') {
          // If we have a currentVersion reference, fetch the actual version document
          let currentVersionNumber = '1'
          if (originalDoc?.currentVersion) {
            const versionDoc = await req.payload.findByID({
              collection: 'versions',
              id: originalDoc.currentVersion
            })
            if (versionDoc) {
              currentVersionNumber = versionDoc.version
            }
          }

          // Check if currentVersion is NOT in the right format (legacy items missing a version)
          if (!originalDoc.currentVersion || typeof originalDoc.currentVersion !== 'string') {
            // Create a new version from current data
            const newVersion = await req.payload.create({
              collection: 'versions',
              data: {
                item: originalDoc.id,
                version: currentVersionNumber,
                createdAt: new Date().toISOString(),
                createdBy: req.user?.id,
                snapshot: {
                  title: originalDoc.title,
                  description: originalDoc.description,
                  type: originalDoc.type,
                  license: originalDoc.license,
                  openspaceVersion: originalDoc.openspaceVersion,
                  image: originalDoc.image,
                  assetBundle: originalDoc.assetBundle,
                },
                changedFields: [],
              },
            })

            // Update originalDoc with the new version reference
            originalDoc.currentVersion = newVersion.id
            originalDoc.archives = []
          }

          // Only a new file upload or a license change warrants a new version.
          // Title, description, OpenSpace version, and image are metadata edits
          // that update the current version in place instead.
          const requiresNewVersion =
            data.license !== originalDoc.license ||
            data.assetBundle !== originalDoc.assetBundle

          if (requiresNewVersion) {
            // Create new version with incremented version number
            const newVersion = await req.payload.create({
              collection: 'versions',
              data: {
                item: originalDoc.id,
                version: String(parseInt(currentVersionNumber) + 1),
                createdAt: new Date().toISOString(),
                createdBy: req.user?.id,
                snapshot: {
                  title: data.title,
                  description: data.description,
                  type: data.type,
                  license: data.license,
                  openspaceVersion: data.openspaceVersion,
                  image: data.image,
                  assetBundle: data.assetBundle,
                },
                changedFields: getChangedFields(originalDoc, data),
              },
            })

            // Update item with new version references
            data.currentVersion = newVersion.id

            // Handle archives properly
            if (originalDoc.currentVersion) {
              const currentArchives = originalDoc.archives || []
              data.archives = [...currentArchives, originalDoc.currentVersion]
            }
          } else if (originalDoc.currentVersion) {
            // Metadata-only edit: keep the current version's snapshot in sync
            // with the live item instead of archiving a new version.
            await req.payload.update({
              collection: 'versions',
              id: originalDoc.currentVersion,
              data: {
                snapshot: {
                  title: data.title,
                  description: data.description,
                  type: data.type,
                  license: data.license,
                  openspaceVersion: data.openspaceVersion,
                  image: data.image,
                  assetBundle: data.assetBundle,
                },
              },
            })
          }
        }

        // Add automatic tags based on item properties
        if (data) {
          const tags = []

          // Add OpenSpace Version tag
          if (data.openspaceVersion) {
            const versionTag = await req.payload.find({
              collection: 'tags',
              where: {
                type: { equals: 'openspaceVersion' },
                name: { equals: data.openspaceVersion },
              },
            })
            if (versionTag.docs.length > 0) {
              tags.push(versionTag.docs[0].id)
            } else {
              // Versions are no longer a hardcoded list (they come from the
              // site-config global), so a tag may not have been seeded for this
              // one yet - create it on the fly instead of silently dropping it.
              const createdVersionTag = await req.payload.create({
                collection: 'tags',
                data: { name: data.openspaceVersion, type: 'openspaceVersion' },
              })
              tags.push(createdVersionTag.id)
            }
          }

          // Add License tag
          if (data.license) {
            const licenseTag = await req.payload.find({
              collection: 'tags',
              where: {
                type: { equals: 'license' },
                name: { equals: data.license },
              },
            })
            if (licenseTag.docs.length > 0) {
              tags.push(licenseTag.docs[0].id)
            }
          }

          // Add Item Type tag
          if (data.type) {
            const typeTag = await req.payload.find({
              collection: 'tags',
              where: {
                type: { equals: 'itemType' },
                name: { equals: data.type },
              },
            })
            if (typeTag.docs.length > 0) {
              tags.push(typeTag.docs[0].id)
            } else {
              // Same gap as OpenSpace version tags above: a newly added item
              // type won't have a seeded tag until the seed script re-runs,
              // so create it on the fly instead of silently dropping it.
              const createdTypeTag = await req.payload.create({
                collection: 'tags',
                data: { name: data.type, type: 'itemType' },
              })
              tags.push(createdTypeTag.id)
            }
          }

          // Merge with existing tags
          data.tags = [...new Set([...(data.tags || []), ...tags])]
        }

        console.log('data after', data)
        return data
      },
    ],
    afterChange: [
      async ({ req, doc, operation }) => {
        if (operation === 'create' && req.user) {
          // Add the new item to the author's items array
          const userResult = await req.payload.findByID({
            collection: 'users',
            id: req.user.id,
          })

          if (userResult) {
            const currentItems = userResult.items || []
            await req.payload.update({
              collection: 'users',
              id: req.user.id,
              data: {
                items: [...currentItems, doc.id],
              },
            })
          }

          // Create the initial version (1) snapshot and link it as the current version
          const initialVersion = await req.payload.create({
            collection: 'versions',
            data: {
              item: doc.id,
              version: '1',
              createdAt: new Date().toISOString(),
              createdBy: req.user.id,
              snapshot: {
                title: doc.title,
                description: doc.description,
                type: doc.type,
                license: doc.license,
                openspaceVersion: doc.openspaceVersion,
                image: doc.image,
                assetBundle: doc.assetBundle,
              },
              changedFields: [],
            },
          })

          await req.payload.update({
            collection: 'items',
            id: doc.id,
            data: {
              currentVersion: initialVersion.id,
              archives: [],
            },
            // Prevent this internal linking update from re-triggering the
            // versioning/tagging logic in beforeChange above.
            context: { skipItemHooks: true },
          })
        }
      },
    ],
    // Remove the item's versions and files along with it
    afterDelete: [deleteItemData],
  },
  fields: [
    // Non-versioned fields
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'state',
      type: 'select',
      options: ['draft', 'published', 'archived'],
      defaultValue: 'published',
      // Moderation: only admins publish, archive or draft items, so authors can't undo it
      access: {
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
    },
    {
      name: 'tags',
      type: 'relationship',
      relationTo: 'tags',
      hasMany: true,
    },
    {
      name: 'favoritedBy',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      // Changed only through the /favorite endpoint (local API) or by admins
      access: {
        read: () => true,
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
    },
    {
      name: 'favoritesCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Derived from favoritedBy length, kept in sync by a beforeChange hook.',
      },
      // The hook sets it after client values are stripped, so this only blocks direct edits
      access: {
        read: () => true,
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
    },
    // Anonymous usage counters, only ever bumped by the /track endpoint
    {
      name: 'downloadCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Times the Download button was used. Anonymous: no one is recorded.',
      },
      access: {
        read: () => true,
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
    },
    {
      name: 'importCount',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Times the item was imported into OpenSpace. Anonymous: no one is recorded.',
      },
      access: {
        read: () => true,
        create: isAdminFieldLevel,
        update: isAdminFieldLevel,
      },
    },
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'titleLower',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description: 'Lowercased copy of title, kept in sync by a beforeChange hook, used for case-insensitive sorting.',
        hidden: true,
      },
      access: {
        read: () => true,
      },
    },
    {
      name: 'description',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: ['asset', 'profile', 'recording', 'webpanel', 'config', 'showcomposer', 'package'],
      required: true,
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
      defaultValue: '0.21.1',
      required: true,
      validate: validateOpenspaceVersion,
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

    // Version references
    {
      name: 'currentVersion',
      type: 'relationship',
      relationTo: 'versions',
    },
    {
      name: 'archives',
      type: 'relationship',
      relationTo: 'versions',
      hasMany: true,
      defaultValue: [],
    },
  ],
  endpoints: [
    // {
    //   path: '/items/favorited-by',
    //   method: 'get',
    //   handler: async (req: PayloadRequest) => {
    //     return req.payload.find({
    //       collection: 'items',
    //       where: { favoritedBy: { equals: req.user?.id } },
    //     })
    //   },
    // },
    {
      // Tags used by all items matching `where` (same query format as GET /api/items), with
      // how many of those items carry each tag. Lets the gallery offer every tag that would
      // still match, not just the tags on the current page. Runs with the caller's access,
      // so unpublished items they can't see aren't counted
      path: '/tag-facets',
      method: 'get',
      handler: withCors(async (req: PayloadRequest) => {
        try {
          const items = await req.payload.find({
            collection: 'items',
            where: (req.query?.where ?? {}) as Where,
            pagination: false,
            depth: 0,
            select: { tags: true },
            overrideAccess: false,
            req,
          })

          const counts = new Map<string, number>()
          for (const item of items.docs) {
            for (const tag of item.tags ?? []) {
              const tagId = typeof tag === 'string' ? tag : tag.id
              counts.set(tagId, (counts.get(tagId) ?? 0) + 1)
            }
          }

          const tags = await req.payload.find({
            collection: 'tags',
            where: { id: { in: [...counts.keys()] } },
            pagination: false,
            depth: 0,
          })

          return Response.json({
            totalDocs: items.docs.length,
            tags: tags.docs
              .map((tag) => ({ id: tag.id, name: tag.name, type: tag.type, count: counts.get(tag.id) ?? 0 }))
              .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
          })
        } catch (error) {
          // e.g. a malformed or disallowed `where`
          return Response.json({ error: (error as Error).message }, { status: 400 })
        }
      }),
    },
    {
      // Anonymous download/import counter: { kind: 'download' | 'import' }. No login needed and
      // nothing about the caller is stored, only the item's counter goes up
      path: '/:id/track',
      method: 'post',
      handler: withCors(async (req: PayloadRequest) => {
        const { id } = req.routeParams as { id: string }

        let kind: unknown
        try {
          kind = ((await req.json?.()) as { kind?: unknown } | undefined)?.kind
        } catch {
          // fall through to the validation below
        }
        if (kind !== 'download' && kind !== 'import') {
          return Response.json({ error: "kind must be 'download' or 'import'" }, { status: 400 })
        }

        // Repeat clicks from one address on one item inside the window are ignored (still a 200,
        // so the client can't tell). Kept in memory only and never written anywhere
        const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        if (ip) {
          const key = `${ip}|${id}|${kind}`
          const now = Date.now()
          if (trackedRecently.size > 10000) {
            for (const [k, time] of trackedRecently) {
              if (now - time > TRACK_WINDOW_MS) trackedRecently.delete(k)
            }
          }
          const last = trackedRecently.get(key)
          if (last !== undefined && now - last < TRACK_WINDOW_MS) {
            return Response.json({ ok: true })
          }
          trackedRecently.set(key, now)
        }

        // One atomic $inc straight on the collection, so simultaneous clicks aren't lost and no
        // hooks, versions or updatedAt changes are triggered. Only published items count
        try {
          const result = await req.payload.db.collections['items'].updateOne(
            { _id: id, state: 'published' },
            { $inc: { [kind === 'download' ? 'downloadCount' : 'importCount']: 1 } },
            { timestamps: false },
          )
          if (result.matchedCount === 0) {
            return Response.json({ error: 'item not found' }, { status: 404 })
          }
        } catch {
          // e.g. a malformed id
          return Response.json({ error: 'item not found' }, { status: 404 })
        }
        return Response.json({ ok: true })
      }),
    },
    {
      path: '/:id/favorite',
      method: 'post',
      handler: withCors(async (req: PayloadRequest) => {
        // console.log('req')
        // //get headers
        // console.log(req.headers)

        // console.log(req.user)
        if (!req.user) {
          // console.log('no user')
          // console.log(req)
          return Response.json({ error: 'forbidden' }, { status: 403 })
        }

        const { id } = req.routeParams as { id: string }

        const itemResult = await req.payload.find({
          collection: 'items',
          where: { id: { equals: id }, state: { equals: 'published' } },
        })

        if (!itemResult || !itemResult.docs[0]) {
          return Response.json({ error: 'item not found' }, { status: 404 })
        }
        const itemDoc = itemResult.docs[0]
        const { favoritedBy } = itemDoc || {} // Initialize with empty array if undefined

        const userResult = await req.payload.find({
          collection: 'users',
          where: { id: { equals: req.user.id } },
        })

        if (!userResult || !userResult.docs[0]) {
          // This case should ideally not happen if req.user is set
          return Response.json({ error: 'user not found' }, { status: 404 })
        }
        const userDoc = userResult.docs[0]
        const { favorites } = userDoc as User // Initialize with empty array if undefined

        const isFavorited = favoritedBy
          ?.map((v: string | User) => (typeof v === 'string' ? v : v.id))
          ?.includes(req.user.id)

        if (isFavorited) {
          // Item is already favorited, so unfavorite it
          const updatedFavoritedBy = favoritedBy?.filter(
            (v: string | User) => (typeof v === 'string' ? v : v.id) !== req.user?.id,
          )
          const itemResult = await req.payload.update({
            collection: 'items',
            id,
            data: { favoritedBy: updatedFavoritedBy },
            // This is a partial update (only favoritedBy), so the version-management
            // hook would otherwise see undefined for title/license/etc. and think
            // every field changed, spuriously archiving a new version on every click.
            context: { skipItemHooks: true },
          })
          // console.log('favorites before filter', favorites)

          const updatedFavorites = favorites?.filter(
            (item: string | Item) => typeof item === 'string' || item.id !== id,
          )
          console.log('updatedF avorites afte rftilr ', updatedFavorites)
          await req.payload.update({
            collection: 'users',
            id: req.user.id,
            data: { favorites: updatedFavorites },
          })
          return Response.json(
            {
              favoritedBy: itemResult.favoritedBy,

              message: 'item unfavorited',
            },
            { status: 200 },
          )
        } else {
          // Item is not favorited, so favorite it
          const updatedFavoritedBy = [...(favoritedBy || []), req.user.id]
          const itemResult = await req.payload.update({
            collection: 'items',
            id,
            data: { favoritedBy: updatedFavoritedBy },
            context: { skipItemHooks: true },
          })

          const updatedFavorites = [...(favorites || []), id]
          await req.payload.update({
            collection: 'users',
            id: req.user.id,
            data: { favorites: updatedFavorites },
          })
          return Response.json(
            { favoritedBy: itemResult.favoritedBy, message: 'Item favorited' },
            { status: 200 },
          )
        }
      }),
    },
  ],
}
