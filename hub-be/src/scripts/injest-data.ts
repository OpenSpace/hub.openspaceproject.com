import { Payload } from 'payload'
import { randomBytes } from 'crypto'
import fs from 'fs'
import path from 'path'
import {
  bundleMimeTypes,
  findAssetEntryPath,
  listZipContents,
  readZipEntries,
} from '@/collections/AssetBundles'
import type { Item, Tag } from '@/payload-types'
import { toMinorVersion } from '@/validation/openspaceVersion'
import { defaultSiteConfig } from './seed-global-config'

// Imports items, users and their files exported from the old OpenSpace Hub
// (hub.openspaceproject.com). Put these in INJEST_DIR (default hub-be/injest/):
//   hubitems.json  mongoexport of the `hubitems` collection (JSON lines or --jsonArray)
//   users.json     mongoexport of the `users` collection (optional, but needed for real emails)
//   users/...      the old server's uploads/ folder contents; item and image paths are relative
// Re-running skips items that already exist (same title and author).

interface OldUser {
  _id: string
  name: string
  email: string
  username: string
  thumbnail?: string
  link?: string
  institution?: string
  role?: string
  favorites?: string[]
}

interface OldFileVersion {
  version: string
  url: string
}

interface OldItem {
  _id: string
  name: string
  type: string
  description: string
  author: { name: string; username: string; link?: string; institution?: string }
  license: string
  openspaceVersion: string
  currentVersion: OldFileVersion
  image?: string
  archives?: OldFileVersion[]
  created?: string
  favorites?: string[]
  required?: string[]
}

export interface IngestReport {
  usersCreated: number
  usersExisting: number
  placeholderUsers: string[]
  itemsCreated: number
  itemsSkipped: string[]
  itemsFailed: string[]
  missingFiles: string[]
  warnings: string[]
}

const INJEST_DIR = process.env.INJEST_DIR || path.join(process.cwd(), 'injest')

const IMAGE_MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
}

// mongoexport writes Extended JSON ({ $oid }, { $numberInt }, { $date }); flatten to plain values
const unwrap = (value: any): any => {
  if (Array.isArray(value)) {
    return value.map(unwrap)
  }
  if (value && typeof value === 'object') {
    if ('$oid' in value) return value.$oid
    if ('$numberInt' in value) return Number(value.$numberInt)
    if ('$numberLong' in value) return Number(value.$numberLong)
    if ('$numberDouble' in value) return Number(value.$numberDouble)
    if ('$date' in value) return unwrap(value.$date)
    return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, unwrap(v)]))
  }
  return value
}

// A mongoexport file as either JSON lines or a JSON array; [] if the file doesn't exist
const readExport = <T>(fileName: string): T[] | undefined => {
  const filePath = path.join(INJEST_DIR, fileName)
  if (!fs.existsSync(filePath)) {
    return undefined
  }
  const text = fs.readFileSync(filePath, 'utf-8').trim()
  const records = text.startsWith('[')
    ? JSON.parse(text)
    : text.split('\n').filter((line) => line.trim()).map((line) => JSON.parse(line))
  return records.map(unwrap)
}

// The old app stored dates as display strings ("10/25/2024, 08:19:34 GMT+0200")
const parseDate = (value: string | undefined) => {
  const date = value ? new Date(value.replace(/, /, ' ')) : undefined
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : new Date().toISOString()
}

// Nobody needs to know it: these users log in through Firebase. A shared password would let
// anyone log in as them through Payload's email/password login
const randomPassword = () => randomBytes(32).toString('hex')

const injestData = async (payload: Payload): Promise<IngestReport> => {
  const report: IngestReport = {
    usersCreated: 0,
    usersExisting: 0,
    placeholderUsers: [],
    itemsCreated: 0,
    itemsSkipped: [],
    itemsFailed: [],
    missingFiles: [],
    warnings: [],
  }

  const items = readExport<OldItem>('hubitems.json')
  if (!items) {
    throw new Error(`No hubitems.json in ${INJEST_DIR}`)
  }
  const oldUsers = readExport<OldUser>('users.json')
  if (!oldUsers) {
    report.warnings.push('No users.json: authors get placeholder emails and must be linked by an admin')
  }

  const readFile = (relativePath: string | undefined) => {
    const filePath = relativePath && path.join(INJEST_DIR, relativePath)
    if (!filePath || !fs.existsSync(filePath)) {
      report.missingFiles.push(relativePath || '(no path)')
      return undefined
    }
    return fs.readFileSync(filePath)
  }

  const uploadImage = async (relativePath: string | undefined, alt: string, ownerId: string) => {
    if (!relativePath || relativePath.startsWith('defaults/')) {
      return undefined
    }
    const buffer = readFile(relativePath)
    if (!buffer) {
      return undefined
    }
    const extension = path.extname(relativePath).toLowerCase()
    const image = await payload.create({
      collection: 'media',
      data: { alt, prefix: ownerId },
      file: {
        data: buffer,
        mimetype: IMAGE_MIME_TYPES[extension] || 'image/png',
        name: path.basename(relativePath),
        size: buffer.length,
      },
    })
    return image.id
  }

  // Uploads a bundle the way /validate-and-upload does: zip file list, asset entry path, and
  // the owner's storage folder
  const uploadBundle = async (relativePath: string, title: string, type: string, ownerId: string) => {
    const buffer = readFile(relativePath)
    if (!buffer) {
      return undefined
    }
    const extension = path.extname(relativePath).toLowerCase()
    const fileName = path.basename(relativePath)
    let contents
    let entryPath
    if (extension === '.zip') {
      try {
        const zipEntries = readZipEntries(new Uint8Array(buffer))
        contents = listZipContents(zipEntries)
        if (type === 'asset') {
          const baseName = path.basename(fileName, '.zip')
          entryPath =
            findAssetEntryPath(zipEntries, baseName) ||
            findAssetEntryPath(zipEntries, baseName.replace(/-\d+$/, ''))
          if (!entryPath) {
            report.warnings.push(`${relativePath}: no ${baseName}.asset inside; import will guess`)
          }
        }
      } catch (error) {
        report.warnings.push(`${relativePath}: could not read zip (${(error as Error).message})`)
      }
    }
    const bundle = await payload.create({
      collection: 'asset-bundles',
      data: { title, type: type as 'asset', entryPath, contents, prefix: ownerId },
      file: {
        data: buffer,
        mimetype: bundleMimeTypes[extension] || 'application/octet-stream',
        name: fileName,
        size: buffer.length,
      },
    })
    return bundle.id
  }

  // 1. Users, matched to existing ones by email or username so re-runs don't duplicate them
  const userIdByOldId = new Map<string, string>()
  const userIdByUsername = new Map<string, string>()
  for (const oldUser of oldUsers ?? []) {
    const email = oldUser.email?.trim().toLowerCase()
    const existing = await payload.find({
      collection: 'users',
      where: { or: [{ email: { equals: email } }, { username: { equals: oldUser.username } }] },
      depth: 0,
      limit: 1,
    })
    let userId = existing.docs[0]?.id
    if (userId) {
      report.usersExisting++
    } else {
      const user = await payload.create({
        collection: 'users',
        data: {
          name: oldUser.name,
          email,
          username: oldUser.username,
          link: oldUser.link || 'www.example.com',
          institution: oldUser.institution || 'OpenSpace',
          role: oldUser.role === 'admin' ? ['admin', 'user'] : ['user'],
          password: randomPassword(),
        },
      })
      userId = user.id
      report.usersCreated++
      const thumbnail = await uploadImage(oldUser.thumbnail, oldUser.username, userId)
      if (thumbnail) {
        await payload.update({ collection: 'users', id: userId, data: { thumbnail } })
      }
    }
    userIdByOldId.set(oldUser._id, userId)
    userIdByUsername.set(oldUser.username, userId)
  }

  // Item authors are embedded copies; find the user by username, or make a placeholder
  const authorId = async (author: OldItem['author']) => {
    const known = userIdByUsername.get(author.username)
    if (known) {
      return known
    }
    const existing = await payload.find({
      collection: 'users',
      where: { username: { equals: author.username } },
      depth: 0,
      limit: 1,
    })
    let userId = existing.docs[0]?.id
    if (!userId) {
      const user = await payload.create({
        collection: 'users',
        data: {
          name: author.name,
          email: `${author.username}@placeholder.invalid`,
          username: author.username,
          link: author.link || 'www.example.com',
          institution: author.institution || 'OpenSpace',
          role: ['user'],
          password: randomPassword(),
        },
      })
      userId = user.id
      report.placeholderUsers.push(author.username)
    }
    userIdByUsername.set(author.username, userId)
    return userId
  }

  // Tags by type and name; OpenSpace versions missing from the site config get created
  const tagIds = new Map(
    (await payload.find({ collection: 'tags', pagination: false, depth: 0 })).docs.map((tag) => [
      `${tag.type}:${tag.name}`,
      tag.id,
    ]),
  )
  const tagId = async (type: Tag['type'], name: string | undefined) => {
    if (!name) {
      return undefined
    }
    const key = `${type}:${name}`
    if (!tagIds.has(key)) {
      if (type !== 'openspaceVersion') {
        report.warnings.push(`No ${type} tag "${name}"; add it to the site config`)
        return undefined
      }
      const tag = await payload.create({ collection: 'tags', data: { type, name } })
      tagIds.set(key, tag.id)
      report.warnings.push(`Created missing OpenSpace version tag ${name}; add it to the site config`)
    }
    return tagIds.get(key)
  }

  // 2. Items, each with its image, every file version, and tags
  const itemIdByOldId = new Map<string, string>()
  let skippedDependencies = 0

  for (const oldItem of items) {
    const label = `${oldItem.name} (${oldItem.author.username})`
    try {
      const ownerId = await authorId(oldItem.author)
      const existing = await payload.find({
        collection: 'items',
        where: { title: { equals: oldItem.name }, author: { equals: ownerId } },
        depth: 0,
        limit: 1,
      })
      if (existing.docs[0]) {
        itemIdByOldId.set(oldItem._id, existing.docs[0].id)
        report.itemsSkipped.push(label)
        continue
      }

      const imageId = await uploadImage(oldItem.image, oldItem.name, ownerId)
      // Oldest first, current version last
      const fileVersions = [
        ...[...(oldItem.archives ?? [])].sort((a, b) =>
          a.version.localeCompare(b.version, undefined, { numeric: true }),
        ),
        oldItem.currentVersion,
      ]
      const bundles: { version: string; bundleId: string }[] = []
      for (const fileVersion of fileVersions) {
        const bundleId = await uploadBundle(fileVersion.url, oldItem.name, oldItem.type, ownerId)
        if (bundleId) {
          bundles.push({ version: fileVersion.version, bundleId })
        }
      }
      const current = bundles.find((bundle) => bundle.version === oldItem.currentVersion.version)
      if (!current) {
        report.itemsFailed.push(`${label}: current version file missing (${oldItem.currentVersion.url})`)
        continue
      }

      const tags = (
        await Promise.all([
          tagId('openspaceVersion', oldItem.openspaceVersion && toMinorVersion(oldItem.openspaceVersion)),
          tagId('license', oldItem.license),
          tagId('itemType', oldItem.type),
        ])
      ).filter((id): id is string => Boolean(id))

      // The license field only accepts the licenses in the site config
      const license = defaultSiteConfig.licenses.includes(oldItem.license)
        ? (oldItem.license as Item['license'])
        : undefined
      if (oldItem.license && !license) {
        report.warnings.push(`${label}: unknown license "${oldItem.license}" left blank`)
      }

      const createdAt = parseDate(oldItem.created)
      const item = await payload.create({
        collection: 'items',
        data: {
          title: oldItem.name,
          type: oldItem.type as 'asset',
          description: oldItem.description,
          image: imageId,
          author: ownerId,
          license,
          openspaceVersion: oldItem.openspaceVersion,
          assetBundle: current.bundleId,
          state: 'published',
          tags,
          createdAt,
        },
      })

      const versionIds: string[] = []
      for (const bundle of bundles) {
        const version = await payload.create({
          collection: 'versions',
          data: {
            item: item.id,
            version: bundle.version,
            createdAt,
            createdBy: ownerId,
            snapshot: {
              title: oldItem.name,
              description: oldItem.description,
              type: oldItem.type as 'asset',
              license,
              openspaceVersion: oldItem.openspaceVersion,
              image: imageId,
              assetBundle: bundle.bundleId,
            },
            changedFields: [],
          },
        })
        versionIds.push(version.id)
      }
      await payload.update({
        collection: 'items',
        id: item.id,
        data: { currentVersion: versionIds.at(-1), archives: versionIds.slice(0, -1) },
        context: { skipItemHooks: true },
      })

      itemIdByOldId.set(oldItem._id, item.id)
      skippedDependencies += oldItem.required?.length ?? 0
      report.itemsCreated++
    } catch (error) {
      report.itemsFailed.push(`${label}: ${(error as Error).message}`)
    }
  }

  // 3. Favorites, once every user and item exists. The old Hub kept them on both the item and
  // the user; here they only live on the item
  const favoritedBy = new Map<string, Set<string>>()
  const addFavorite = (itemId: string | undefined, userId: string | undefined) => {
    if (itemId && userId) {
      favoritedBy.set(itemId, (favoritedBy.get(itemId) ?? new Set()).add(userId))
    }
  }
  for (const oldItem of items) {
    for (const oldUserId of oldItem.favorites ?? []) {
      addFavorite(itemIdByOldId.get(oldItem._id), userIdByOldId.get(oldUserId))
    }
  }
  for (const oldUser of oldUsers ?? []) {
    for (const oldItemId of oldUser.favorites ?? []) {
      addFavorite(itemIdByOldId.get(oldItemId), userIdByOldId.get(oldUser._id))
    }
  }
  for (const [itemId, userIds] of favoritedBy) {
    await payload.update({
      collection: 'items',
      id: itemId,
      data: { favoritedBy: [...userIds] },
      context: { skipItemHooks: true },
    })
  }

  if (skippedDependencies > 0) {
    report.warnings.push(
      `${skippedDependencies} "required" item links were not imported (the new Hub has no field for them)`,
    )
  }
  return report
}

export default injestData
