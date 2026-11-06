import { getPayload } from 'payload'
import configPromise from '@payload-config'
import fs from 'fs'
import path from 'path'
import backup from './backup'

const formatBytes = (bytes: number) => `${(bytes / 1e6).toFixed(1)} MB`

const dirSize = (dir: string) =>
  fs.readdirSync(dir).reduce((sum, name) => sum + fs.statSync(path.join(dir, name)).size, 0)

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    const { dir, manifest, pruned } = await backup(payload, {
      filesOnly: process.argv.includes('--files-only'),
    })
    console.log(`Backup written to ${dir} (${formatBytes(dirSize(dir))})`)
    console.log(`  database: ${manifest.database}`)
    console.log(`  uploads: ${manifest.uploads.files} files, media: ${manifest.media.files} files`)
    console.log(
      `  skipped: ${manifest.skipped.files} older/unused files (${formatBytes(manifest.skipped.bytes)})`,
    )
    const missing = [...manifest.uploads.missingOnDisk, ...manifest.media.missingOnDisk]
    if (missing.length > 0) {
      console.log(`  MISSING on disk (${missing.length}): ${missing.join(', ')}`)
    }
    if (pruned.length > 0) {
      console.log(`  removed old backups: ${pruned.join(', ')}`)
    }
  } catch (error) {
    console.error('Backup failed:', error)
    process.exitCode = 1
  } finally {
    process.exit()
  }
}

run()
