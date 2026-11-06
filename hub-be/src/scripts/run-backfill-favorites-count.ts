import { getPayload } from 'payload'
import configPromise from '@payload-config'
import backfillFavoritesCount from './backfill-favorites-count'

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    await backfillFavoritesCount(payload)
  } catch (error) {
    console.error('Error backfilling favoritesCount:', error)
  } finally {
    process.exit(0)
  }
}

run()
