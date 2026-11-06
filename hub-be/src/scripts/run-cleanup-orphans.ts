import { getPayload } from 'payload'
import configPromise from '@payload-config'
import cleanupOrphans from './cleanup-orphans'

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    await cleanupOrphans(payload, { apply: process.argv.includes('--apply') })
  } catch (error) {
    console.error('Cleanup failed:', error)
    process.exitCode = 1
  } finally {
    process.exit()
  }
}

run()
