import { getPayload } from 'payload'
import configPromise from '@payload-config'
import backfillAssetContents from './backfill-asset-contents'

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    await backfillAssetContents(payload)
  } catch (error) {
    console.error('Error backfilling asset contents:', error)
    process.exitCode = 1
  } finally {
    process.exit()
  }
}

run()
