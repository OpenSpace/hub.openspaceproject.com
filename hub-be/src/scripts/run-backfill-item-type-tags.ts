import { getPayload } from 'payload'
import configPromise from '@payload-config'
import backfillItemTypeTags from './backfill-item-type-tags'

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    await backfillItemTypeTags(payload)
  } catch (error) {
    console.error('Error backfilling item type tags:', error)
  } finally {
    process.exit(0)
  }
}

run()
