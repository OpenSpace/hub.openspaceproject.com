import { getPayload } from 'payload'
import configPromise from '@payload-config'
import backfillOpenspaceVersionTags from './backfill-openspace-version-tags'

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    await backfillOpenspaceVersionTags(payload)
  } catch (error) {
    console.error('Error backfilling OpenSpace version tags:', error)
  } finally {
    process.exit(0)
  }
}

run()
