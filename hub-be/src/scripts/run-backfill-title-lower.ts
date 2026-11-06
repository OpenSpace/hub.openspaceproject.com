import { getPayload } from 'payload'
import configPromise from '@payload-config'
import backfillTitleLower from './backfill-title-lower'

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    await backfillTitleLower(payload)
  } catch (error) {
    console.error('Error backfilling titleLower:', error)
  } finally {
    process.exit(0)
  }
}

run()
