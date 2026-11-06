// Unlock an account that was locked out after too many failed logins to the admin panel:
//   yarn unlock-admin you@example.com
import { getPayload } from 'payload'
import configPromise from '@payload-config'

const run = async () => {
  try {
    const email = process.argv.slice(2).find((arg) => arg.includes('@'))
    if (!email) {
      console.error('Usage: yarn unlock-admin <email>')
      process.exit(1)
    }

    // Initialize payload using the same pattern as route.ts
    const payload = await getPayload({
      config: configPromise,
    })

    const result = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
    })

    if (!result.docs.length) {
      console.error('❌ No user found with email:', email)
      process.exit(1)
    }

    const user = result.docs[0]

    await payload.update({
      collection: 'users',
      id: user.id,
      data: {
        // @ts-ignore
        locked: false,
        loginAttempts: 0,
      },
    })

    console.log(`✅ Admin user "${email}" unlocked successfully`)
    process.exit(0)
  } catch (err: any) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

run()
