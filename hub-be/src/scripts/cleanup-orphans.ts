import { createLocalReq, Payload } from 'payload'
import { deleteUnusedFiles, idOf } from '@/accounts/userData'

// Cleans up what item deletes left behind before items took their versions and files with
// them (see deleteItemData): versions of deleted items, and files only those versions used.
// Only reports unless `apply` is set
const cleanupOrphans = async (payload: Payload, { apply = false } = {}) => {
  const req = await createLocalReq({}, payload)
  const allItems = (
    await payload.find({ collection: 'items', pagination: false, depth: 0, select: { author: true } })
  ).docs
  const itemIds = new Set(allItems.map((item) => item.id))

  const versions = await payload.find({ collection: 'versions', pagination: false, depth: 0 })
  const orphanVersions = versions.docs.filter((version) => {
    const itemId = idOf(version.item)
    return itemId && !itemIds.has(itemId)
  })
  const media = new Set<string>()
  const bundles = new Set<string>()
  for (const version of orphanVersions) {
    const image = idOf(version.snapshot?.image)
    const bundle = idOf(version.snapshot?.assetBundle)
    if (image) media.add(image)
    if (bundle) bundles.add(bundle)
    console.log(`version ${version.id} (v${version.version} "${version.snapshot?.title}") of deleted item ${idOf(version.item)}`)
  }
  console.log(`${orphanVersions.length} versions of deleted items, using ${media.size} images and ${bundles.size} files`)

  if (!apply) {
    console.log('Dry run: nothing changed. Run with --apply to clean up')
    return
  }

  for (const version of orphanVersions) {
    await payload.delete({ collection: 'versions', id: version.id, req })
  }
  // Only deletes files no remaining item, version or user points at
  await deleteUnusedFiles('media', media, req)
  await deleteUnusedFiles('asset-bundles', bundles, req)
  console.log(`Deleted ${orphanVersions.length} versions`)
}

export default cleanupOrphans
