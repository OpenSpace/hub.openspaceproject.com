import { Payload } from 'payload'

const backfillOpenspaceVersionTags = async (payload: Payload) => {
  const items = await payload.find({
    collection: 'items',
    limit: 10000,
    depth: 0,
  })

  const tagCache = new Map<string, string>()

  const getOrCreateVersionTagId = async (version: string): Promise<string> => {
    const cached = tagCache.get(version)
    if (cached) {
      return cached
    }

    const existing = await payload.find({
      collection: 'tags',
      where: {
        type: { equals: 'openspaceVersion' },
        name: { equals: version },
      },
    })

    let tagId = existing.docs[0]?.id

    if (!tagId) {
      const created = await payload.create({
        collection: 'tags',
        data: { name: version, type: 'openspaceVersion' },
      })
      tagId = created.id
    }

    tagCache.set(version, tagId)
    return tagId
  }

  let updated = 0

  for (const item of items.docs) {
    if (!item.openspaceVersion) {
      continue
    }

    const tagId = await getOrCreateVersionTagId(item.openspaceVersion)
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

  console.log(`Added the OpenSpace version tag to ${updated} of ${items.docs.length} items`)
}

export default backfillOpenspaceVersionTags
