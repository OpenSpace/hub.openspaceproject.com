import type { Adapter } from '@payloadcms/plugin-cloud-storage/types'
import type { CollectionBeforeChangeHook, Field } from 'payload'
import { headersWithCors } from 'payload'
import fs from 'fs'
import fsPromises from 'fs/promises'
import path from 'path'
import { Readable } from 'stream'

// Uploads are stored on local disk in a folder per uploader: <staticDir>/<user id>/<filename>.
// Files that can't be tied to a user (e.g. created by scripts) go here
export const UNASSIGNED_FOLDER = '_unassigned'

// Where each collection's files live; override to keep them elsewhere (e.g. on a data disk)
export const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads'
export const MEDIA_DIR = process.env.MEDIA_DIR || 'media'

// The folder (relative to the collection's staticDir) a file is stored in. The cloud-storage
// plugin passes it to the adapter as `prefix`
export const userFolderField: Field = {
  name: 'prefix',
  type: 'text',
  admin: { readOnly: true, description: 'Storage folder (the uploader’s user ID)' },
}

// Put new uploads in the uploader's folder; keep a file's existing folder when it is replaced.
// Runs before the cloud-storage plugin's own beforeChange hook, which writes the file
export const setUserFolder: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!data.prefix) {
    data.prefix = originalDoc?.prefix || req.user?.id || UNASSIGNED_FOLDER
  }
  return data
}

// Absolute directory a collection's files live under (same resolution as Payload's own)
export const storageRoot = (staticDir: string | undefined, slug: string) =>
  path.resolve(staticDir || slug)

// Path of a stored file; files from before folders existed have no prefix and sit in the root
export const storedFilePath = (root: string, prefix: string | null | undefined, filename: string) =>
  path.join(root, prefix || '', filename)

// Local-disk adapter for @payloadcms/plugin-cloud-storage that writes each file into its
// `prefix` folder. URLs stay /api/<collection>/file/<filename>: filenames are still unique per
// collection (Payload renames duplicates), so the folder is looked up from the filename
export const userFolderAdapter: Adapter = ({ collection }) => {
  const root = storageRoot(
    typeof collection.upload === 'object' ? collection.upload.staticDir : undefined,
    collection.slug,
  )

  return {
    name: 'user-folders',

    handleUpload: async ({ data, file }) => {
      const filePath = storedFilePath(root, data.prefix, file.filename)
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true })
      if (file.tempFilePath) {
        await fsPromises.copyFile(file.tempFilePath, filePath)
      } else {
        await fsPromises.writeFile(filePath, file.buffer)
      }
    },

    handleDelete: async ({ doc, filename }) => {
      await fsPromises.rm(storedFilePath(root, doc.prefix, filename), { force: true })
    },

    // Payload has already checked read access and rejected paths containing ../
    staticHandler: async (req, { params }) => {
      const { docs } = await req.payload.find({
        collection: collection.slug as 'media' | 'asset-bundles',
        where: { filename: { equals: params.filename } },
        depth: 0,
        limit: 1,
        overrideAccess: true,
        req,
      })
      const doc = docs[0] as { prefix?: string | null; mimeType?: string | null } | undefined
      const filePath = storedFilePath(root, doc?.prefix, params.filename)

      let size: number
      try {
        size = (await fsPromises.stat(filePath)).size
      } catch {
        req.payload.logger.error(`File ${params.filename} is missing on disk. Expected: ${filePath}`)
        return Response.json({ errors: [{ message: 'Not Found' }] }, { status: 404 })
      }

      const headers = new Headers({
        'Content-Type': doc?.mimeType || 'application/octet-stream',
        'Content-Length': String(size),
        // Uploads are user content served from the API's own origin: never let an uploaded
        // HTML or SVG file run scripts there (where an admin's login cookie lives), and stop
        // browsers guessing a more dangerous type than the one stored
        'Content-Security-Policy': 'sandbox',
        'X-Content-Type-Options': 'nosniff',
      })
      return new Response(Readable.toWeb(fs.createReadStream(filePath)) as ReadableStream, {
        headers: headersWithCors({ headers, req }),
        status: 200,
      })
    },
  }
}
