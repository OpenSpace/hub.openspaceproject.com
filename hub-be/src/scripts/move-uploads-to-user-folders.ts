import { Payload } from 'payload'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'
import {
  MEDIA_DIR,
  storageRoot,
  storedFilePath,
  UNASSIGNED_FOLDER,
  UPLOADS_DIR,
} from '@/storage/userFolders'

type UploadSlug = 'media' | 'asset-bundles'

const idOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : (value as { id?: string } | null)?.id

const formatBytes = (bytes: number) =>
  bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1e3).toFixed(1)} KB`

// Work out which user each stored file belongs to: the author of the item (or archived
// version) using it, or the user whose profile picture it is
const findOwners = async (payload: Payload) => {
  const owners: Record<UploadSlug, Map<string, string>> = {
    media: new Map(),
    'asset-bundles': new Map(),
  }
  const claim = (slug: UploadSlug, fileId: string | undefined, owner: string | undefined) => {
    if (fileId && owner && !owners[slug].has(fileId)) {
      owners[slug].set(fileId, owner)
    }
  }

  const items = await payload.find({ collection: 'items', pagination: false, depth: 0 })
  const itemAuthors = new Map<string, string | undefined>()
  for (const item of items.docs) {
    const author = idOf(item.author)
    itemAuthors.set(item.id, author)
    claim('media', idOf(item.image), author)
    claim('asset-bundles', idOf(item.assetBundle), author)
  }

  const versions = await payload.find({ collection: 'versions', pagination: false, depth: 0 })
  for (const version of versions.docs) {
    const owner = itemAuthors.get(idOf(version.item) ?? '') ?? idOf(version.createdBy)
    claim('media', idOf(version.snapshot?.image), owner)
    claim('asset-bundles', idOf(version.snapshot?.assetBundle), owner)
  }

  const users = await payload.find({ collection: 'users', pagination: false, depth: 0 })
  for (const user of users.docs) {
    claim('media', idOf(user.thumbnail), user.id)
  }

  return { owners, usernames: new Map(users.docs.map((user) => [user.id, user.username])) }
}

// Move every upload that has no folder yet into <staticDir>/<owner id>/ and record the folder.
// Dry run unless `apply` is true. File contents are never changed
const moveUploadsToUserFolders = async (payload: Payload, apply: boolean) => {
  const { owners, usernames } = await findOwners(payload)
  const usage = new Map<string, number>()
  let moved = 0
  let problems = 0

  for (const slug of ['asset-bundles', 'media'] as const) {
    const root = storageRoot(slug === 'asset-bundles' ? UPLOADS_DIR : MEDIA_DIR, slug)
    const docs = await payload.find({ collection: slug, pagination: false, depth: 0 })
    console.log(`\n== ${slug} (${path.relative(process.cwd(), root)}/)`)

    for (const doc of docs.docs) {
      const owner = owners[slug].get(doc.id) ?? UNASSIGNED_FOLDER
      usage.set(owner, (usage.get(owner) ?? 0) + (doc.filesize ?? 0))
      if (doc.prefix || !doc.filename) {
        continue
      }

      const from = storedFilePath(root, undefined, doc.filename)
      const to = storedFilePath(root, owner, doc.filename)
      const label = `${doc.filename} -> ${owner}/${doc.filename}`
      if (!existsSync(from)) {
        console.log(`  MISSING  ${label} (no file at ${from})`)
        problems++
        continue
      }
      if (existsSync(to)) {
        console.log(`  CONFLICT ${label} (target already exists)`)
        problems++
        continue
      }
      console.log(`  ${apply ? 'moved   ' : 'would move'} ${label}`)
      moved++

      if (apply) {
        await fs.mkdir(path.dirname(to), { recursive: true })
        await fs.rename(from, to)
        try {
          // Straight to the database: only the folder changes, so skip hooks and validation
          await payload.db.updateOne({ collection: slug, id: doc.id, data: { prefix: owner } })
        } catch (error) {
          await fs.rename(to, from)
          throw error
        }
      }
    }
  }

  console.log(`\n== space per user (all files, including ones already in folders)`)
  for (const [owner, bytes] of [...usage.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${formatBytes(bytes).padStart(9)}  ${owner} ${usernames.get(owner) ?? ''}`)
  }
  console.log(
    `\n${apply ? 'Moved' : 'Would move'} ${moved} files, ${problems} problems.` +
      (apply ? '' : ' Dry run only: run with --apply to move them.'),
  )
}

export default moveUploadsToUserFolders
