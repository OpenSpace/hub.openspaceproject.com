import { CollectionConfig } from 'payload'
import path from 'path'
import { unzipSync } from 'fflate'
import { withCors } from '@/withCors'
import { canUploadRequest, isAdmin, UPLOADS_DISABLED_MESSAGE } from '@/Access'
import { setUserFolder, UPLOADS_DIR, userFolderField } from '@/storage/userFolders'
//Allow different types and file extensions based on type field:
// Recording:   *.osrec    (binary)    *.osrectxt    (text)
// Profile:   *.profile  and JSON file
// Webpanel:   *.zip (with <folder>/index.html inside)    index.html
// ShowComposer Panel:   *.zip

const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Return the path of the first entry in an unzipped bundle matching `pattern`
const findZipEntry = (zipData: Record<string, Uint8Array>, pattern: RegExp): string | undefined =>
  Object.keys(zipData).find((fileName) => pattern.test(fileName))

// Largest bundle accepted, both as uploaded and (for .zip files) once unzipped
export const MAX_BUNDLE_BYTES = 512e6
const MAX_BUNDLE_LABEL = '512 MB'

class BundleTooLargeError extends Error {}

// Unzip a bundle in memory, refusing it before extracting anything if its files add up to more
// than MAX_BUNDLE_BYTES. fflate extracts each file into a buffer of the size its header states,
// so a zip can't claim small sizes here and then expand past them (a "zip bomb")
const unzipBundle = (data: Uint8Array): Record<string, Uint8Array> => {
  let total = 0
  return unzipSync(data, {
    filter: (entry) => {
      total += entry.originalSize
      if (total > MAX_BUNDLE_BYTES) {
        throw new BundleTooLargeError(`Unzipped bundle is larger than ${MAX_BUNDLE_LABEL}`)
      }
      return true
    },
  })
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

// Packages are unzipped straight into user/, so every entry must sit in one of its folders.
// Returns an error message, or undefined if the package is valid
const checkPackageZip = (zipData: Record<string, Uint8Array>): string | undefined => {
  const fileNames = Object.keys(zipData)
    // Some Windows zip tools write \ instead of / between folders
    .map((fileName) => fileName.replace(/\\/g, '/'))
    // Ignore macOS Finder metadata
    .filter((fileName) => !fileName.startsWith('__MACOSX/') && !fileName.endsWith('.DS_Store'))
  if (fileNames.length === 0) {
    return 'Package ZIP is empty'
  }
  const unsafe = fileNames.find(
    (fileName) => /^([a-zA-Z]:)?[\\/]/.test(fileName) || fileName.split(/[\\/]/).includes('..'),
  )
  if (unsafe) {
    return `Package ZIP contains an invalid path: ${unsafe}`
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

// Files inside an unzipped bundle with their uncompressed sizes, skipping folder entries.
// Stored on the bundle so the hub can show them and imports can check for overwrites up front
export const listZipContents = (zipData: Record<string, Uint8Array>): ZipContentsEntry[] =>
  Object.entries(zipData)
    .filter(([fileName]) => !fileName.endsWith('/'))
    .map(([fileName, data]) => ({ path: fileName, size: data.byteLength }))

// Find the path of `<baseName>.asset` (or `.jasset`) inside an unzipped asset bundle, e.g. "foo/foo.asset".
// Stored on the bundle so imports don't depend on the (possibly de-duplicated, e.g. foo-1.zip)
// stored filename.
export const findAssetEntryPath = (
  zipData: Record<string, Uint8Array>,
  baseName: string,
): string | undefined => findZipEntry(zipData, assetEntryPattern(baseName))

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
    read: () => true,
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
      options: ['asset', 'profile', 'recording', 'webpanel', 'config', 'showcomposer', 'package'],
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
            return new Response('You must be logged in to upload', { status: 401 })
          }
          if (!(await canUploadRequest(req))) {
            return new Response(UPLOADS_DISABLED_MESSAGE, { status: 403 })
          }
          // const formData = await req.json?.()
          const formData = await req.formData?.()
          const file = formData?.get('file') as File
          const id = formData?.get('id') as string
          const payload = JSON.parse(formData?.get('_payload') as string)
          const title = payload?.title
          const type = payload?.type
          if (!file) {
            return new Response('No file provided', { status: 400 })
          }
          if (file.size > MAX_BUNDLE_BYTES) {
            return new Response(`File is larger than ${MAX_BUNDLE_LABEL}`, { status: 413 })
          }

          // Validate based on type
          const fileExt = path.extname(file.name).toLowerCase()
          let isValid = false
          let errorMessage = ''
          let entryPath: string | undefined
          // Read and unzip once; every check below works on these
          const fileData = new Uint8Array(await file.arrayBuffer())
          const zipData = fileExt === '.zip' ? unzipBundle(fileData) : undefined

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
                isValid = Boolean(zipData && findZipEntry(zipData, /^[^/]+\/index\.html$/))
                errorMessage = 'Webpanel ZIP must contain a folder with index.html inside (e.g. mypanel/index.html)'
              } else {
                isValid = fileExt === '.html'
                errorMessage = 'Webpanel must be .zip with index.html or .html file'
              }
              break

            case 'config':
              if (fileExt === '.zip') {
                isValid = Boolean(zipData && findZipEntry(zipData, /(^|\/)[^/]+\.json$/))
                errorMessage = 'Config .zip must contain a .json file'
              } else {
                isValid = fileExt === '.json';
                errorMessage = 'Config must be a .json file or be a .zip containing a .json file';
              }
              break
            case 'asset':
              if (fileExt === '.zip') {
                entryPath =
                  zipData && findAssetEntryPath(zipData, path.basename(file.name, '.zip'))
                isValid = Boolean(entryPath)
                errorMessage = 'Asset ZIP must contain *.asset or *.jasset with same name as zip file'
              } else {
                isValid = fileExt === '.asset' || fileExt === '.jasset'
                errorMessage = 'Asset must be .asset file or .jasset file'
              }
              break
            case 'showcomposer':
              if (fileExt === '.zip') {
                isValid = Boolean(zipData && findZipEntry(zipData, /(^|\/)data\.json$/))
                errorMessage = 'ShowComposer Panel .zip must contain a data.json file'
              } else {
                isValid = false;
                errorMessage = 'ShowComposer Panel must be a .zip file';
              }
              break
            case 'package':
              if (zipData) {
                const packageError = checkPackageZip(zipData)
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
            return new Response(errorMessage, { status: 400 })
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
          const contents = zipData ? listZipContents(zipData) : undefined

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

          return new Response(JSON.stringify(result), {
            status: 200,
            // headers: {
            //   'Access-Control-Allow-Origin': 'http://localhost:5173',
            //   'Access-Control-Allow-Credentials': 'true',
            // },
          })
        } catch (error: any) {
          if (error instanceof BundleTooLargeError) {
            return new Response(error.message, { status: 413 })
          }
          console.error(error)
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            // headers: {
            //   'Access-Control-Allow-Origin': 'http://localhost:5173',
            //   'Access-Control-Allow-Credentials': 'true',
            // },
          })
        }
      }),
    },
  ],
}
