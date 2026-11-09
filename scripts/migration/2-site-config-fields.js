// Migration 2: the site-config global's options used to be one JSON field, `config`. They are now
// separate fields (upload, signin, ..., versions, itemTypes, licenses), so this moves each option
// out of `config` and then deletes `config`. Options already set as fields are kept, and item
// types the code doesn't know and switches that aren't true/false are listed and dropped.
// Run it right after deploying that change; until then the site uses the default switches (all
// on except allowImport) and has no versions, item types or licenses to choose from.
//
// From the repository root, with hub-be's dependencies installed:
//   node scripts/migration/2-site-config-fields.js            make the changes
//   node scripts/migration/2-site-config-fields.js --dry-run  only show what would change
// The database comes from DATABASE_URI, or else hub-be/.env. Running it again changes nothing.
'use strict'

const path = require('path')
const { createRequire } = require('module')

const hubBe = path.resolve(__dirname, '..', '..', 'hub-be')
const requireFromBackend = createRequire(path.join(hubBe, 'package.json'))
const { MongoClient } = requireFromBackend('mongodb')
requireFromBackend('dotenv').config({ path: path.join(hubBe, '.env'), quiet: true })

// The types in hub-be/src/itemTypes.ts when this was written
const ITEM_TYPES = ['asset', 'profile', 'recording', 'webpanel', 'config', 'showcomposer', 'package']
const SWITCHES = ['upload', 'signin', 'showFavoriteCounts', 'showDownloadCounts', 'allowImport']
const LISTS = ['versions', 'itemTypes', 'licenses']

// Shown in the terminal as JSON, so stored text can't send escape codes to it
const show = (value) => JSON.stringify(value)

const main = async () => {
  const args = process.argv.slice(2)
  const unknown = args.filter((arg) => arg !== '--dry-run')
  if (unknown.length) {
    console.error(`Unknown option ${unknown[0]}. Use --dry-run or nothing.`)
    process.exitCode = 1
    return
  }
  const dryRun = args.includes('--dry-run')

  const uri = process.env.DATABASE_URI
  if (!uri) {
    console.error(`DATABASE_URI is not set, neither in the environment nor in ${hubBe}/.env`)
    process.exitCode = 1
    return
  }

  const client = new MongoClient(uri)
  try {
    await client.connect()
    const globals = client.db().collection('globals')
    const doc = await globals.findOne({ globalType: 'site-config' })
    if (!doc || doc.config === undefined) {
      console.log('The site config has no old `config` field. Nothing to do.')
      return
    }

    const config = doc.config && typeof doc.config === 'object' ? doc.config : {}
    const set = {}
    for (const [key, value] of Object.entries(config)) {
      if (doc[key] !== undefined && (SWITCHES.includes(key) || LISTS.includes(key))) {
        console.log(`${key}: already set to ${show(doc[key])}, ignoring ${show(value)}`)
      } else if (SWITCHES.includes(key)) {
        if (typeof value === 'boolean') {
          set[key] = value
        } else {
          console.log(`${key}: dropping ${show(value)}, which isn't true or false`)
        }
      } else if (LISTS.includes(key)) {
        const strings = Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : []
        const kept = key === 'itemTypes' ? strings.filter((type) => ITEM_TYPES.includes(type)) : strings
        const dropped = Array.isArray(value) ? value.filter((entry) => !kept.includes(entry)) : [value]
        if (dropped.length) {
          console.log(`${key}: dropping ${show(dropped)}`)
        }
        set[key] = [...new Set(kept)]
      } else {
        console.log(`Dropping unknown option ${key}: ${show(value)}`)
      }
    }
    for (const [key, value] of Object.entries(set)) {
      console.log(`${key}: ${show(value)}`)
    }
    for (const key of LISTS) {
      if (!(set[key] ?? doc[key])?.length) {
        console.log(`Warning: ${key} is empty. Fill it in under Globals > Site Config in /admin.`)
      }
    }

    if (!dryRun) {
      const update = { $unset: { config: '' } }
      if (Object.keys(set).length) {
        update.$set = set
      }
      await globals.updateOne({ _id: doc._id }, update)
    }
    console.log(`\n${dryRun ? 'Would move' : 'Moved'} ${Object.keys(set).length} option(s) out of \`config\`.`)
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
