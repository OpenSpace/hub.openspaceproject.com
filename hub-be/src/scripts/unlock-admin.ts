// Unlock an account that was locked out after too many failed logins to the admin panel:
//   npm run unlock-admin -- you@example.com
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import type { UserAuthOperations } from '../payload-types'

const run = async () => {
  try {
    const email = process.argv.slice(2).find((arg) => arg.includes('@'))
    if (!email) {
      console.error('Usage: npm run unlock-admin -- <email>')
      process.exit(1)
    }

    // Initialize payload using the same pattern as route.ts
    const payload = await getPayload({
      config: configPromise,
    })

    const result = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      depth: 0,
      limit: 1,
    })

    if (!result.docs.length) {
      console.error('❌ No user found with email:', email)
      process.exit(1)
    }

    await payload.unlock({
      collection: 'users',
      // Generated types wrongly require `password` for unlock; Payload ignores it.
      data: { email } as UserAuthOperations['unlock'],
      overrideAccess: true,
    })

    console.log(`✅ Admin user "${email}" unlocked successfully`)
    process.exit(0)
  } catch (err: any) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

run()
