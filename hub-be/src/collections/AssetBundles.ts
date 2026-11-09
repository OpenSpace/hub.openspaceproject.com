import { CollectionConfig } from 'payload'
import path from 'path'
import { unzipSync } from 'fflate'
import { apiError } from '@/apiError'
import { withCors } from '@/withCors'
import {
  canUploadRequest,
  fileUsageFields,
  isAdmin,
  readUsedOrOwnFiles,
  UPLOADS_DISABLED_MESSAGE,
} from '@/Access'
import { ITEM_TYPES } from '@/itemTypes'
import { setUserFolder, UPLOADS_DIR, userFolderField } from '@/storage/userFolders'
//Allow different types and file extensions based on type field:
// Recording:   *.osrec    (binary)    *.osrectxt    (text)
// Profile:   *.profile  and JSON file
// Webpanel:   *.zip (with <folder>/index.html inside)    index.html
// ShowComposer Panel:   *.zip

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Path -> uncompressed size of every entry in a zip
export type ZipEntries = Record<string, number>

// Reads only the zip's directory; sizes are as the zip states them, nothing is decompressed
export const readZipEntries = (data: Uint8Array): ZipEntries => {
  const entries: ZipEntries = {}
  unzipSync(data, {
    filter: (entry) => {
      entries[entry.name] = entry.originalSize
      return false
    },
  })
  return entries
}

// Return the path of the first entry in a zip bundle matching `pattern`
const findZipEntry = (zipEntries: ZipEntries, pattern: RegExp): string | undefined =>
  Object.keys(zipEntries).find((fileName) => pattern.test(fileName))

// Largest bundle accepted, both as uploaded and (for .zip files) once unzipped
export const MAX_BUNDLE_BYTES = 512e6
const MAX_BUNDLE_LABEL = '512 MB'

class BundleTooLargeError extends Error {}

const readBundleEntries = (data: Uint8Array): ZipEntries => {
  const entries = readZipEntries(data)
  const total = Object.values(entries).reduce((sum, size) => sum + size, 0)
  if (total > MAX_BUNDLE_BYTES) {
    throw new BundleTooLargeError(`Unzipped bundle is larger than ${MAX_BUNDLE_LABEL}`)
  }
  return entries
}

const assetEntryPattern = (baseName: string) =>
  new RegExp(`(^|/)${escapeRegExp(baseName)}\\.j?asset$`)

// Top-level folders of the OpenSpace user/ folder (from the ${USER}/... tokens in openspace.cfg)
const packageFolders = [
  'config',
  'data',
  'globebrowsing',
  'recordings',
  'screenshots',
  'scripts',
  'showcomposer',
  'webpanels',
]

// Imports unzip into the user's OpenSpace folders, so no entry may point outside them
export const isUnsafeZipPath = (fileName: string) =>
  /^([a-zA-Z]:|[\\/])/.test(fileName) || fileName.split(/[\\/]/).includes('..')

// Packages are unzipped straight into user/, so every entry must sit in one of its folders.
// Returns an error message, or undefined if the package is valid
const checkPackageZip = (zipEntries: ZipEntries): string | undefined => {
  const fileNames = Object.keys(zipEntries)
    // Some Windows zip tools write \ instead of / between folders
    .map((fileName) => fileName.replace(/\\/g, '/'))
    // Ignore macOS Finder metadata
    .filter((fileName) => !fileName.startsWith('__MACOSX/') && !fileName.endsWith('.DS_Store'))
  if (fileNames.length === 0) {
    return 'Package ZIP is empty'
  }
  const folderList = packageFolders.map((folder) => `${folder}/`).join(', ')
  const inUserFolder = (fileName: string) => packageFolders.includes(fileName.split('/')[0])
  if (!fileNames.some(inUserFolder)) {
    return (
      `Package ZIP must mirror the user/ folder, but none of these folders were found at the ` +
      `top level of the ZIP: ${folderList}. Make sure they aren't inside another folder.`
    )
  }
  const misplaced = fileNames.find((fileName) => !inUserFolder(fileName))
  if (misplaced) {
    return (
      `Package ZIP must only contain files inside the user/ folders (${folderList}), ` +
      `but "${misplaced}" is not inside one of them`
    )
  }
  return undefined
}

// Mimetype for each bundle file extension (browsers don't know the OpenSpace ones)
export const bundleMimeTypes: Record<string, string> = {
  '.zip': 'application/zip',
  '.html': 'text/html',
  '.json': 'application/json',
  '.profile': 'application/json',
  '.osrec': 'application/octet-stream',
  '.osrectxt': 'text/plain',
  '.asset': 'text/plain',
  '.jasset': 'application/json',
}

export interface ZipContentsEntry {
  path: string
  size: number
}

// Files inside a zip bundle with their uncompressed sizes, skipping folder entries.
// Stored on the bundle so the hub can show them and imports can check for overwrites up front
export const listZipContents = (zipEntries: ZipEntries): ZipContentsEntry[] =>
  Object.entries(zipEntries)
    .filter(([fileName]) => !fileName.endsWith('/'))
    .map(([fileName, size]) => ({ path: fileName, size }))

// Find the path of `<baseName>.asset` (or `.jasset`) inside a zip asset bundle, e.g. "foo/foo.asset".
// Stored on the bundle so imports don't depend on the (possibly de-duplicated, e.g. foo-1.zip)
// stored filename.
export const findAssetEntryPath = (
  zipEntries: ZipEntries,
  baseName: string,
): string | undefined => findZipEntry(zipEntries, assetEntryPattern(baseName))

export const AssetBundles: CollectionConfig = {
  slug: 'asset-bundles',
  upload: {
    staticDir: UPLOADS_DIR,
    mimeTypes: [
      'application/zip',
      'text/plain',
      'application/json',
      'text/html',
      'application/x-zip-compressed',
      'application/octet-stream',
    ],
  },
  access: {
    read: readUsedOrOwnFiles({ profiles: false }),
    // Turns off the plain POST /api/asset-bundles route, which would skip the file checks:
    // bundles are only added through /validate-and-upload below (it checks login and
    // canUploadRequest itself, then creates through the local API, which skips this)
    create: () => false,
    // Files are only replaced or removed through their item (or by admins); Payload's default
    // would let any logged-in user change or delete anyone's files
    update: isAdmin,
    delete: isAdmin,
  },
  // Leave `contents` out when bundles are populated on items/versions, since it can list
  // thousands of files. Fetch it from asset-bundles directly when needed
  defaultPopulate: {
    title: true,
    type: true,
    entryPath: true,
    url: true,
    filename: true,
    mimeType: true,
    filesize: true,
    updatedAt: true,
    createdAt: true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      options: [...ITEM_TYPES],
    },
    {
      // Path of the entry .asset file inside an asset .zip, relative to the zip root
      name: 'entryPath',
      type: 'text',
      admin: { readOnly: true },
    },
    {
      // Files inside a .zip bundle as [{ path, size }], relative to the zip root.
      // Unset for single-file bundles
      name: 'contents',
      type: 'json',
      admin: { readOnly: true },
      typescriptSchema: [
        () => ({
          type: 'array',
          items: {
            type: 'object',
            properties: { path: { type: 'string' }, size: { type: 'number' } },
            required: ['path', 'size'],
            additionalProperties: false,
          },
        }),
      ],
    },
    userFolderField,
    ...fileUsageFields('assetBundle', { profiles: false }),
  ],
  hooks: {
    beforeChange: [setUserFolder],
  },

  endpoints: [
    {
      path: '/validate-and-upload',
      method: 'post',
      handler: withCors(async (req) => {
        try {
          // payload.create below uses the local API, which skips collection access, so check
          // here too: logged in, and uploads not switched off in site-config
          if (!req.user) {
            return apiError('You must be logged in to upload', 401)
          }
          if (!(await canUploadRequest(req))) {
            return apiError(UPLOADS_DISABLED_MESSAGE, 403)
          }
          // const formData = await req.json?.()
          const formData = await req.formData?.()
          const file = formData?.get('file') as File
          const id = formData?.get('id') as string
          const payload = JSON.parse(formData?.get('_payload') as string)
          const title = payload?.title
          const type = payload?.type
          if (!file) {
            return apiError('No file provided', 400)
          }
          if (file.size > MAX_BUNDLE_BYTES) {
            return apiError(`File is larger than ${MAX_BUNDLE_LABEL}`, 413)
          }

          // Validate based on type
          const fileExt = path.extname(file.name).toLowerCase()
          let isValid = false
          let errorMessage = ''
          let entryPath: string | undefined
          // Read the file and its zip entries once; every check below works on these
          const fileData = new Uint8Array(await file.arrayBuffer())
          const zipEntries = fileExt === '.zip' ? readBundleEntries(fileData) : undefined
          const unsafePath = zipEntries && Object.keys(zipEntries).find(isUnsafeZipPath)
          if (unsafePath) {
            return apiError(`ZIP contains an invalid path: ${unsafePath}`, 400)
          }

          switch (type) {
            case 'recording':
              isValid = ['.osrec', '.osrectxt'].includes(fileExt)
              errorMessage = 'Recording must be .osrec or .osrectxt file'
              break

            case 'profile':
              isValid = ['.profile', '.json'].includes(fileExt)
              errorMessage = 'Profile must be .profile or .json file'
              break

            case 'webpanel':
              if (fileExt === '.zip') {
                // index.html must sit in a top-level folder (e.g. apc40/index.html), since the
                // import unzips straight into the user webpanels folder
                isValid = Boolean(zipEntries && findZipEntry(zipEntries, /^[^/]+\/index\.html$/))
                errorMessage = 'Webpanel ZIP must contain a folder with index.html inside (e.g. mypanel/index.html)'
              } else {
                isValid = fileExt === '.html'
                errorMessage = 'Webpanel must be .zip with index.html or .html file'
              }
              break

            case 'config':
              if (fileExt === '.zip') {
                isValid = Boolean(zipEntries && findZipEntry(zipEntries, /(^|\/)[^/]+\.json$/))
                errorMessage = 'Config .zip must contain a .json file'
              } else {
                isValid = fileExt === '.json';
                errorMessage = 'Config must be a .json file or be a .zip containing a .json file';
              }
              break
            case 'asset':
              if (fileExt === '.zip') {
                entryPath =
                  zipEntries && findAssetEntryPath(zipEntries, path.basename(file.name, '.zip'))
                isValid = Boolean(entryPath)
                errorMessage = 'Asset ZIP must contain *.asset or *.jasset with same name as zip file'
              } else {
                isValid = fileExt === '.asset' || fileExt === '.jasset'
                errorMessage = 'Asset must be .asset file or .jasset file'
              }
              break
            case 'showcomposer':
              if (fileExt === '.zip') {
                isValid = Boolean(zipEntries && findZipEntry(zipEntries, /(^|\/)data\.json$/))
                errorMessage = 'ShowComposer Panel .zip must contain a data.json file'
              } else {
                isValid = false;
                errorMessage = 'ShowComposer Panel must be a .zip file';
              }
              break
            case 'package':
              if (zipEntries) {
                const packageError = checkPackageZip(zipEntries)
                isValid = !packageError
                errorMessage = packageError ?? ''
              } else {
                isValid = false
                errorMessage = 'Package must be a .zip file'
              }
              break
            default:
              isValid = false
              errorMessage = 'Invalid type specified'
          }

          if (!isValid) {
            return apiError(errorMessage, 400)
          }

          // The browser doesn't know custom OpenSpace extensions (.profile, .asset, .osrec, .osrectxt)
          // and sends an empty file.type for them, which fails Payload's mimeTypes validation.
          // Derive the mimetype from the already-validated extension instead of trusting file.type.
          const mimetype =
            bundleMimeTypes[fileExt] || file.type || 'application/octet-stream'

          // Use Payload's local API to create or update
          // const result = id
          //   ? await req.payload.update({
          //       collection: 'asset-bundles',
          //       id,
          //       data: { title, type },
          //       file: {
          //         data: Buffer.from(await file.arrayBuffer()),
          //         mimetype: file.type,
          //         name: file.name,
          //         size: file.size,
          //       },
          //     })
          // :
          const contents = zipEntries ? listZipContents(zipEntries) : undefined

          const result = await req.payload.create({
            collection: 'asset-bundles',
            // This local-API call doesn't carry req.user, so give the uploader's folder here
            data: { title, type, entryPath, contents, prefix: req.user.id },
            file: {
              data: Buffer.from(fileData.buffer, fileData.byteOffset, fileData.byteLength),
              mimetype,
              name: file.name,
              size: file.size,
            },
          })

          // Same shape as Payload's own create response
          return Response.json({ doc: result })
        } catch (error: any) {
          if (error instanceof BundleTooLargeError) {
            return apiError(error.message, 413)
          }
          console.error(error)
          return apiError(error.message, 500)
        }
      }),
    },
  ],
}
