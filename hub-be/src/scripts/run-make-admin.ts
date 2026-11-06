// Make an existing account an admin, e.g. the first one on a fresh hub:
//   yarn make-admin you@example.com
// Sign in to the hub first, so the account exists. Accounts made by signing in have a random
// password, so this also prints a new one for logging in to the admin panel (/admin)
import { randomBytes } from 'crypto'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const run = async () => {
  const email = process.argv.slice(2).find((arg) => arg.includes('@'))
  if (!email) {
    console.error('Usage: yarn make-admin <email>')
    process.exit(1)
  }

  const payload = await getPayload({ config: configPromise })
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    depth: 0,
    limit: 1,
  })
  if (!docs.length) {
    console.error(`No account with email ${email}. Sign in to the hub with it first.`)
    process.exit(1)
  }

  const password = randomBytes(12).toString('base64url')
  await payload.update({
    collection: 'users',
    id: docs[0].id,
    data: { role: ['admin'], password },
  })
  console.log(`${email} (${docs[0].username}) is now an admin.`)
  console.log(`Admin panel (/admin) login: ${email} / ${password}`)
  console.log('Keep this password somewhere safe; it is shown only once.')
  process.exit(0)
}

run()
