import { Payload } from "payload"
import { Tag } from "@/payload-types"
import { defaultSiteConfig } from "./seed-global-config"

// Create a tag for every OpenSpace version, license and item type in the site config.
// Tags that already exist are left alone, so this is safe to re-run
const seedTags = async (payload: Payload, config = defaultSiteConfig) => {
  const wanted: { name: string; type: Tag['type'] }[] = [
    ...config.versions.map((name) => ({ name, type: 'openspaceVersion' as const })),
    ...config.licenses.map((name) => ({ name, type: 'license' as const })),
    ...config.itemTypes.map((name) => ({ name, type: 'itemType' as const })),
  ]

  const existing = await payload.find({ collection: 'tags', pagination: false, depth: 0 })
  const have = new Set(existing.docs.map((tag) => `${tag.type}:${tag.name}`))

  let created = 0
  for (const tag of wanted) {
    if (!have.has(`${tag.type}:${tag.name}`)) {
      await payload.create({ collection: 'tags', data: tag })
      created++
    }
  }
  console.log(`Created ${created} tags (${wanted.length - created} already existed)`)
}

export default seedTags
