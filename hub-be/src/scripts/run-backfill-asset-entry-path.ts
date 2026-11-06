import { getPayload } from 'payload'
import configPromise from '@payload-config'
import backfillAssetEntryPath from './backfill-asset-entry-path'

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    await backfillAssetEntryPath(payload)
  } catch (error) {
    console.error('Error backfilling asset entryPath:', error)
  } finally {
    process.exit(0)
  }
}

run()
