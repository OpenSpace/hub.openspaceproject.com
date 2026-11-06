import { Payload } from 'payload'

const backfillFavoritesCount = async (payload: Payload) => {
  const items = await payload.find({
    collection: 'items',
    limit: 10000,
    depth: 0,
  })

  let updated = 0

  for (const item of items.docs) {
    const favoritesCount = Array.isArray(item.favoritedBy) ? item.favoritedBy.length : 0

    if (item.favoritesCount === favoritesCount) {
      continue
    }

    await payload.update({
      collection: 'items',
      id: item.id,
      data: { favoritesCount },
      // Skip version-management/tagging hooks - this is a partial, data-only
      // backfill and shouldn't touch version history.
      context: { skipItemHooks: true },
    })
    updated++
  }

  console.log(`Backfilled favoritesCount on ${updated} of ${items.docs.length} items`)
}

export default backfillFavoritesCount
