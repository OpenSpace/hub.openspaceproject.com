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
    process.exitCode = 1
  } finally {
    process.exit()
  }
}

run()
