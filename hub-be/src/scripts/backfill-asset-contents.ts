import { Payload } from 'payload'
import fs from 'fs/promises'
import { unzipSync } from 'fflate'
import { storageRoot, storedFilePath, UPLOADS_DIR } from '@/storage/userFolders'
import { listZipContents } from '@/collections/AssetBundles'

// Record the file list of every stored .zip bundle that doesn't have one yet.
// Only reads the zips; the stored files are not changed
const backfillAssetContents = async (payload: Payload) => {
  const bundles = await payload.find({
    collection: 'asset-bundles',
    limit: 10000,
    depth: 0,
  })

  let updated = 0

  for (const bundle of bundles.docs) {
    if (bundle.contents || !bundle.filename?.toLowerCase().endsWith('.zip')) {
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

    await payload.update({
      collection: 'asset-bundles',
      id: bundle.id,
      data: { contents: listZipContents(zipData) },
    })
    updated++
  }

  console.log(`Backfilled contents on ${updated} of ${bundles.docs.length} asset bundles`)
}

export default backfillAssetContents
