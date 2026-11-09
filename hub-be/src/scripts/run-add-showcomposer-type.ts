import { getPayload } from 'payload'
import configPromise from '@payload-config'
import addShowcomposerType from './add-showcomposer-type'

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    await addShowcomposerType(payload)
  } catch (error) {
    console.error('Error adding showcomposer item type:', error)
    process.exitCode = 1
  } finally {
    process.exit()
  }
}

run()
