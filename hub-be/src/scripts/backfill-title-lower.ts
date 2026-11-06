import { Payload } from 'payload'

const backfillTitleLower = async (payload: Payload) => {
  const items = await payload.find({
    collection: 'items',
    limit: 10000,
    depth: 0,
  })

  let updated = 0

  for (const item of items.docs) {
    if (typeof item.title !== 'string') {
      continue
    }

    const titleLower = item.title.toLowerCase()

    if (item.titleLower === titleLower) {
      continue
    }

    await payload.update({
      collection: 'items',
      id: item.id,
      data: { titleLower },
      // Partial update - skip version-management hooks (see Items.ts beforeChange).
      context: { skipItemHooks: true },
    })
    updated++
  }

  console.log(`Backfilled titleLower on ${updated} of ${items.docs.length} items`)
}

export default backfillTitleLower
