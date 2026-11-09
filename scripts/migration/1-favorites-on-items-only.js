// Migration 1: a profile's items and favorites are now looked up from the items (Payload join
// fields on `author` and `favoritedBy`), so users no longer keep their own `items` and
// `favorites` lists. This adds favorites that were only on the user's list to the item's
// `favoritedBy`, removes repeated users from `favoritedBy`, recounts `favoritesCount`, and then
// deletes the users' old lists. Who wrote an item comes from its `author`, so the old `items`
// lists are just dropped.
// Run it right after deploying that change; until then some favorites don't show on profiles.
//
// From the repository root, with hub-be's dependencies installed:
//   node scripts/migration/1-favorites-on-items-only.js            make the changes
//   node scripts/migration/1-favorites-on-items-only.js --dry-run  only list what would change
// The database comes from DATABASE_URI, or else hub-be/.env. Running it again changes nothing.
'use strict'

const path = require('path')
const { createRequire } = require('module')

const hubBe = path.resolve(__dirname, '..', '..', 'hub-be')
const requireFromBackend = createRequire(path.join(hubBe, 'package.json'))
const { MongoClient } = requireFromBackend('mongodb')
requireFromBackend('dotenv').config({ path: path.join(hubBe, '.env'), quiet: true })

// Shown in the terminal as JSON, so stored text can't send escape codes to it
const show = (value, max = 60) =>
  JSON.stringify(typeof value === 'string' && value.length > max ? `${value.slice(0, max)}…` : value)

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
    const db = client.db()
    const items = await db
      .collection('items')
      .find({}, { projection: { title: 1, favoritedBy: 1, favoritesCount: 1 } })
      .toArray()
    const oldLists = { $or: [{ items: { $exists: true } }, { favorites: { $exists: true } }] }
    const users = await db
      .collection('users')
      .find(oldLists, { projection: { username: 1, favorites: 1 } })
      .toArray()

    // Each item's favoritedBy by user id, which also drops repeats
    const fans = new Map(
      items.map((item) => [
        String(item._id),
        new Map((item.favoritedBy ?? []).map((userId) => [String(userId), userId])),
      ]),
    )
    const itemById = new Map(items.map((item) => [String(item._id), item]))
    for (const user of users) {
      for (const itemId of user.favorites ?? []) {
        const itemFans = fans.get(String(itemId))
        // Favorites of deleted items have nowhere to go
        if (itemFans && !itemFans.has(String(user._id))) {
          itemFans.set(String(user._id), user._id)
          const { title } = itemById.get(String(itemId))
          console.log(`User ${user._id} ${show(user.username)} favorited item ${itemId} ${show(title)}`)
        }
      }
    }

    const changes = []
    for (const item of items) {
      const favoritedBy = [...fans.get(String(item._id)).values()]
      const before = (item.favoritedBy ?? []).map(String).join()
      if (favoritedBy.map(String).join() !== before || (item.favoritesCount ?? 0) !== favoritedBy.length) {
        changes.push({ _id: item._id, favoritedBy, favoritesCount: favoritedBy.length })
        console.log(
          `Item ${item._id} ${show(item.title)}: favoritedBy ${(item.favoritedBy ?? []).length} -> ` +
            `${favoritedBy.length}, favoritesCount ${item.favoritesCount ?? 'unset'} -> ${favoritedBy.length}`,
        )
      }
    }

    if (!dryRun) {
      for (const { _id, ...set } of changes) {
        await db.collection('items').updateOne({ _id }, { $set: set })
      }
      await db.collection('users').updateMany(oldLists, { $unset: { items: '', favorites: '' } })
    }
    console.log(
      `\n${dryRun ? 'Would change' : 'Changed'} ${changes.length} item(s) and ` +
        `${dryRun ? 'would remove' : 'removed'} the old lists of ${users.length} user(s).`,
    )
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
