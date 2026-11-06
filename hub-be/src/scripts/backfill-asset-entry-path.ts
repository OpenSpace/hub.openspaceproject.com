import { Payload } from 'payload'
import fs from 'fs/promises'
import path from 'path'
import { unzipSync } from 'fflate'
import { storageRoot, storedFilePath, UPLOADS_DIR } from '@/storage/userFolders'
import { findAssetEntryPath } from '@/collections/AssetBundles'

const backfillAssetEntryPath = async (payload: Payload) => {
  const bundles = await payload.find({
    collection: 'asset-bundles',
    where: { type: { equals: 'asset' } },
    limit: 10000,
    depth: 0,
  })

  let updated = 0

  for (const bundle of bundles.docs) {
    if (bundle.entryPath || !bundle.filename?.toLowerCase().endsWith('.zip')) {
      continue
    }

    let zipData: Record<string, Uint8Array>
    try {
      const buffer = await fs.readFile(storedFilePath(storageRoot(UPLOADS_DIR, 'asset-bundles'), bundle.prefix, bundle.filename))
      zipData = unzipSync(new Uint8Array(buffer))
    } catch (error) {
      console.warn(`Skipping ${bundle.filename}: could not read zip`, error)
      continue
    }

    // Payload de-duplicates stored filenames (foo.zip -> foo-1.zip), so also try without the suffix
    const baseName = path.basename(bundle.filename, path.extname(bundle.filename))
    const entryPath =
      findAssetEntryPath(zipData, baseName) ||
      findAssetEntryPath(zipData, baseName.replace(/-\d+$/, ''))

    if (!entryPath) {
      console.warn(`Skipping ${bundle.filename}: no matching .asset file found`)
      continue
    }

    await payload.update({
      collection: 'asset-bundles',
      id: bundle.id,
      data: { entryPath },
    })
    updated++
  }

  console.log(`Backfilled entryPath on ${updated} of ${bundles.docs.length} asset bundles`)
}

export default backfillAssetEntryPath
