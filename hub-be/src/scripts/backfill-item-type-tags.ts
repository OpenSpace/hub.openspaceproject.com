import { Payload } from 'payload'

const backfillItemTypeTags = async (payload: Payload) => {
  const items = await payload.find({
    collection: 'items',
    limit: 10000,
    depth: 0,
  })

  const tagCache = new Map<string, string>()

  const getOrCreateTypeTagId = async (type: string): Promise<string> => {
    const cached = tagCache.get(type)
    if (cached) {
      return cached
    }

    const existing = await payload.find({
      collection: 'tags',
      where: {
        type: { equals: 'itemType' },
        name: { equals: type },
      },
    })

    let tagId = existing.docs[0]?.id

    if (!tagId) {
      const created = await payload.create({
        collection: 'tags',
        data: { name: type, type: 'itemType' },
      })
      tagId = created.id
    }

    tagCache.set(type, tagId)
    return tagId
  }

  let updated = 0

  for (const item of items.docs) {
    if (!item.type) {
      continue
    }

    const tagId = await getOrCreateTypeTagId(item.type)
    const currentTags = (item.tags || []) as (string | { id: string })[]
    const currentTagIds = currentTags.map((t) => (typeof t === 'string' ? t : t.id))

    if (currentTagIds.includes(tagId)) {
      continue
    }

    await payload.update({
      collection: 'items',
      id: item.id,
      data: { tags: [...currentTagIds, tagId] },
      // Partial update - skip version-management hooks (see Items.ts beforeChange).
      context: { skipItemHooks: true },
    })
    updated++
  }

  console.log(`Added the item type tag to ${updated} of ${items.docs.length} items`)
}

export default backfillItemTypeTags
