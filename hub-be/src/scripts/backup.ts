import { Payload } from 'payload'
import { execFileSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import {
  MEDIA_DIR,
  storageRoot,
  storedFilePath,
  UPLOADS_DIR,
} from '@/storage/userFolders'

// Backs up the Hub to BACKUP_DIR/<timestamp>/:
//   mongo.archive.gz  full database (mongodump --archive --gzip)
//   uploads.tar.gz    the current file of every item (older versions are skipped to save space)
//   media.tar.gz      item images and profile pictures
//   manifest.json     what was included and skipped
// Keeps the newest BACKUP_KEEP backups (default 7). Needs `mongodump` (mongodb-database-tools)
// and `tar` on the PATH; `--files-only` skips the database dump.
//
// Restore (from hub-be/, with the server stopped):
//   mongorestore --uri "$DATABASE_URI" --drop --gzip --archive=<backup>/mongo.archive.gz
//   mkdir -p uploads media
//   tar -xzf <backup>/uploads.tar.gz -C uploads
//   tar -xzf <backup>/media.tar.gz -C media
// Older versions still appear in each item's version history, but their files aren't in the
// backup, so they can't be downloaded after a restore.

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups')
const BACKUP_KEEP = Math.max(1, Number(process.env.BACKUP_KEEP) || 7)

const idOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : (value as { id?: string } | null)?.id

interface StoredFile {
  prefix?: string | null
  filename?: string | null
  filesize?: number | null
}

// Writes a gzipped tar of `files` (paths relative to `root`); returns what was missing on disk
const archiveFiles = (root: string, files: StoredFile[], outFile: string) => {
  const included: string[] = []
  const missing: string[] = []
  for (const file of files) {
    const relative = path.relative(root, storedFilePath(root, file.prefix, file.filename!))
    if (fs.existsSync(path.join(root, relative))) {
      included.push(relative.split(path.sep).join('/'))
    } else {
      missing.push(relative)
    }
  }
  const listFile = `${outFile}.list`
  fs.writeFileSync(listFile, included.join('\n'))
  // Run in the output folder and name the archive without a path: GNU tar reads "C:\..." in
  // -f as host:path (a remote archive), which breaks on Windows
  execFileSync('tar', ['-czf', path.basename(outFile), '-C', root, '-T', listFile], {
    cwd: path.dirname(outFile),
  })
  fs.rmSync(listFile)
  return { included: included.length, missing }
}

const backup = async (payload: Payload, { filesOnly = false } = {}) => {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const finalDir = path.join(BACKUP_DIR, stamp)
  // Written under a .partial name and renamed when complete, so a failed run never looks like
  // a usable backup (and isn't counted when pruning)
  const workDir = `${finalDir}.partial`
  fs.mkdirSync(workDir, { recursive: true })

  try {
    if (!filesOnly) {
      // Pass the connection string in a config file so its password isn't on the command line
      const configFile = path.join(workDir, 'mongodump.yaml')
      fs.writeFileSync(configFile, `uri: ${JSON.stringify(process.env.DATABASE_URI)}\n`, { mode: 0o600 })
      try {
        execFileSync(
          'mongodump',
          [`--config=${configFile}`, `--archive=${path.join(workDir, 'mongo.archive.gz')}`, '--gzip'],
          { stdio: ['ignore', 'ignore', 'pipe'] },
        )
      } finally {
        fs.rmSync(configFile, { force: true })
      }
    }

    // Current files only: each item's current bundle and image, and profile pictures
    const items = await payload.find({ collection: 'items', pagination: false, depth: 0 })
    const users = await payload.find({ collection: 'users', pagination: false, depth: 0 })
    const currentBundles = new Set(items.docs.map((item) => idOf(item.assetBundle)).filter(Boolean))
    const currentMedia = new Set(
      [...items.docs.map((item) => idOf(item.image)), ...users.docs.map((user) => idOf(user.thumbnail))].filter(
        Boolean,
      ),
    )

    const bundles = await payload.find({ collection: 'asset-bundles', pagination: false, depth: 0 })
    const media = await payload.find({ collection: 'media', pagination: false, depth: 0 })
    const keptBundles = bundles.docs.filter((doc) => currentBundles.has(doc.id) && doc.filename)
    const keptMedia = media.docs.filter((doc) => currentMedia.has(doc.id) && doc.filename)
    const skipped = [
      ...bundles.docs.filter((doc) => !currentBundles.has(doc.id)),
      ...media.docs.filter((doc) => !currentMedia.has(doc.id)),
    ]

    const uploads = archiveFiles(
      storageRoot(UPLOADS_DIR, 'asset-bundles'),
      keptBundles,
      path.join(workDir, 'uploads.tar.gz'),
    )
    const images = archiveFiles(storageRoot(MEDIA_DIR, 'media'), keptMedia, path.join(workDir, 'media.tar.gz'))

    const manifest = {
      createdAt: new Date().toISOString(),
      database: filesOnly ? 'skipped (--files-only)' : 'mongo.archive.gz',
      uploads: { files: uploads.included, missingOnDisk: uploads.missing },
      media: { files: images.included, missingOnDisk: images.missing },
      skipped: {
        reason: 'older versions and files no item or profile uses',
        files: skipped.length,
        bytes: skipped.reduce((sum, doc) => sum + (doc.filesize ?? 0), 0),
      },
    }
    fs.writeFileSync(path.join(workDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
    fs.renameSync(workDir, finalDir)

    // Keep the newest BACKUP_KEEP complete backups
    const complete = fs
      .readdirSync(BACKUP_DIR)
      .filter((name) => !name.endsWith('.partial') && fs.existsSync(path.join(BACKUP_DIR, name, 'manifest.json')))
      .sort()
    const pruned = complete.slice(0, Math.max(0, complete.length - BACKUP_KEEP))
    for (const name of pruned) {
      fs.rmSync(path.join(BACKUP_DIR, name), { recursive: true, force: true })
    }

    return { dir: finalDir, manifest, pruned }
  } catch (error) {
    fs.rmSync(workDir, { recursive: true, force: true })
    throw error
  }
}

export default backup
