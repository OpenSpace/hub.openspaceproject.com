import { getPayload } from 'payload'
import seedTags from './seed-tags'
import injestData from './injest-data'
import configPromise from '@payload-config'
import seedGlobalConfig from './seed-global-config'

const list = (title: string, entries: string[]) => {
  if (entries.length > 0) {
    console.log(`\n${title} (${entries.length}):`)
    entries.forEach((entry) => console.log(`  - ${entry}`))
  }
}

const runSeeds = async () => {
  // Initialize Payload
  const payload = await getPayload({
    config: configPromise,
  })

  try {
    console.log('Seeding config...')
    await seedGlobalConfig(payload)
    console.log('Seeding tags...')
    await seedTags(payload)
    console.log('Importing old Hub data...')
    const report = await injestData(payload)

    console.log(
      `\nUsers: ${report.usersCreated} created, ${report.usersExisting} already existed` +
        `\nItems: ${report.itemsCreated} created, ${report.itemsSkipped.length} already existed, ` +
        `${report.itemsFailed.length} failed`,
    )
    list('Authors missing from users.json (placeholder email, link them by hand)', report.placeholderUsers)
    list('Failed items', report.itemsFailed)
    list('Missing files', report.missingFiles)
    list('Warnings', report.warnings)
  } catch (error) {
    console.error('Error running seeds:', error)
  } finally {
    process.exit(0)
  }
}

runSeeds()
