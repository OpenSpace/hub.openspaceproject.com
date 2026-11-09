import { getPayload } from 'payload'
import configPromise from '@payload-config'
import moveUploadsToUserFolders from './move-uploads-to-user-folders'

const run = async () => {
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    await moveUploadsToUserFolders(payload, process.argv.includes('--apply'))
  } catch (error) {
    console.error('Error moving uploads to user folders:', error)
    process.exitCode = 1
  } finally {
    process.exit()
  }
}

run()
