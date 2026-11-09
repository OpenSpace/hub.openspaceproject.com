// storage-adapter-import-placeholder
import { randomBytes } from 'crypto'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { payloadCloudPlugin } from '@payloadcms/payload-cloud'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig, type Payload } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
// import { registerUserRoute } from './api/register'
import { headersWithCors } from 'payload'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Versions } from './collections/Versions'
import { Items } from './collections/Items'
import { AssetBundles } from './collections/AssetBundles'
import { SiteConfig } from './globals/site-config'
import { withCors } from './withCors'
import { clientIp, rateLimiter, tooManyRequests } from './abuseLimits'
import { SIGNIN_DISABLED_MESSAGE, signinEnabled } from './Access'
import { s3Storage } from '@payloadcms/storage-s3'
import { cloudStoragePlugin } from '@payloadcms/plugin-cloud-storage'
import { userFolderAdapter } from './storage/userFolders'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)
import path from 'path'
import { Tags } from './collections/Tags'
import { firebaseAuth } from './accounts/firebase'
import seedGlobalConfig from './scripts/seed-global-config'
import seedTags from './scripts/seed-tags'

// Payload signs its login tokens (e.g. the admin panel's) with this, so a missing or
// well-known secret would let anyone forge an admin login. Refuse to start without a real one
const PLACEHOLDER_SECRET = 'YOUR_SECRET_HERE'
const payloadSecret = process.env.PAYLOAD_SECRET
if (!payloadSecret || payloadSecret === PLACEHOLDER_SECRET) {
  throw new Error(
    'PAYLOAD_SECRET must be set to a random value (not the .env.example placeholder). ' +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
  )
}

// Sites allowed to call the API from a browser (cors) and to use the admin login cookie (csrf).
// The local dev servers are only allowed outside production. Add other origins, e.g. the
// backend's own domain if it differs from the hub's, as a comma-separated ALLOWED_ORIGINS
const allowedOrigins = [
  'https://hub.openspaceproject.com',
  ...(process.env.NODE_ENV === 'production'
    ? []
    : [
        'http://localhost:3000',
        'http://hub.openspaceproject.com:3000',
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:8080',
      ]),
  ...(process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
]

export const verifyFirebaseToken = async (idToken: string) => {
  // Outside the try, so a setup problem (e.g. a missing admin key) isn't reported as a bad token
  const auth = firebaseAuth()
  try {
    const decodedToken = await auth.verifyIdToken(idToken)
    return decodedToken
  } catch (error) {
    throw new Error('Invalid Firebase Token')
  }
}

// The part of an email before the @. Profiles are public, so an email must never be shown
// as a name or username
const emailLocalPart = (email?: string) => email?.split('@')[0] ?? ''

// The frontend calls /register on every page load; a 429 there signs the user out, so keep
// this well above what one address (e.g. a whole institution) normally sends
const registerLimit = rateLimiter(60, 60_000)

// A free username for a new account, from its name or email: "Jane Doe" -> "jane-doe",
// then "jane-doe-2", ... if that is taken (usernames are unique)
const uniqueUsername = async (payload: Payload, source: string) => {
  const base =
    source
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '') || 'user'
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? base : `${base}-${n}`
    const { totalDocs } = await payload.count({
      collection: 'users',
      where: { username: { equals: candidate } },
    })
    if (totalDocs === 0) return candidate
  }
}

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  globals: [SiteConfig],
  collections: [Users, Media, Tags, Versions, Items, AssetBundles],
  // A fresh database has no site config, which the frontend and item validation (OpenSpace
  // versions) need, so start it with the defaults and their tags
  onInit: async (payload) => {
    const { config } = await payload.findGlobal({ slug: 'site-config', depth: 0 })
    if (!config) {
      payload.logger.info('No site config yet: adding the defaults and their tags')
      await seedGlobalConfig(payload)
      await seedTags(payload)
    }
  },
  editor: lexicalEditor(),
  // The hub only uses REST; GraphQL would be one more way in (e.g. forgotPassword)
  graphQL: { disable: true },
  secret: payloadSecret,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: mongooseAdapter({
    url: process.env.DATABASE_URI || '',
  }),
  sharp,
  plugins: [
    // Store uploads in a folder per uploader (<staticDir>/<user id>/<filename>) instead of
    // one flat folder. Swapping this adapter for s3Storage later keeps the same prefixes
    cloudStoragePlugin({
      collections: {
        media: { adapter: userFolderAdapter },
        'asset-bundles': { adapter: userFolderAdapter },
      },
    }),
    // s3Storage({
    //   collections: {
    //     media: true,
    //     'asset-bundles': true,
    //   },
    //   bucket: process.env.S3_BUCKET || '',
    //   config: {
    //     credentials: {
    //       accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    //       secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    //     },
    //     region: process.env.S3_REGION || '',
    //     // ... Other S3 configuration
    //   },
    // }),
  ],
  upload: {
    limits: {
      fileSize: 10e9, // 10GB, written in bytes
    },
  },
  cors: allowedOrigins,
  csrf: allowedOrigins,
  endpoints: [
    {
      path: '/register',
      method: 'post',
      handler: withCors(async (req) => {
        const ip = clientIp(req.headers)
        if (ip && !registerLimit(ip)) {
          return tooManyRequests()
        }
        const data = (await req.json?.()) || {}
        const { idToken, username, link, institution } = data

        try {
          const decodedToken = await verifyFirebaseToken(idToken)
          // Check if user exists by Firebase UID
          const existingUser = await req.payload.find({
            collection: 'users',
            where: {
              firebaseUID: {
                equals: decodedToken.uid,
              },
            },
            depth: 0, // Only get the user data, not related collections
          })

          if (existingUser.docs.length > 0) {
            console.log('existingUser', existingUser.docs[0])
            return Response.json(existingUser.docs[0]);
          }

          // Everything below creates or claims a Hub account, which the site-config `signin`
          // switch turns off. Accounts already linked (above) keep working, since the frontend
          // calls this on every page load and refusing them would sign everyone out
          if (!(await signinEnabled(req.payload))) {
            return Response.json({ message: SIGNIN_DISABLED_MESSAGE }, { status: 403 })
          }

          // Claim an existing user (e.g. one from the seed, with no Firebase login yet) by email.
          // Never by username, which anyone can type in, and only when Firebase has verified
          // the caller owns the email; otherwise anyone could take over that account
          const existingUserByEmail = decodedToken.email
            ? await req.payload.find({
                collection: 'users',
                where: {
                  email: { equals: decodedToken.email },
                },
                depth: 0,
              })
            : undefined

          if (existingUserByEmail?.docs.length) {
            if (!decodedToken.email_verified) {
              return Response.json(
                {
                  message:
                    `An account already exists for ${decodedToken.email}, but this login's email ` +
                    'is not verified. Log in with the method you used before, or ask an admin ' +
                    'to connect this login to your account.',
                },
                { status: 409 },
              )
            }
            const updatedUser = await req.payload.update({
              collection: 'users',
              id: existingUserByEmail.docs[0].id,
              data: {
                firebaseUID: decodedToken.uid,
              },
              depth: 0,
            })
            console.log('existingUserByEmail', updatedUser)
            return Response.json(updatedUser)
          }
          // Create new user with Firebase data. Email/password logins have no name, so fall
          // back to the email's local part; users can change both on their profile
          const name = decodedToken.name || emailLocalPart(decodedToken.email) || 'OpenSpace user'
          const newUser = await req.payload.create({
            collection: 'users',
            data: {
              email: decodedToken.email || '',
              firebaseUID: decodedToken.uid,
              name,
              role: ['user'], // Set default role
              username: await uniqueUsername(
                req.payload,
                username || emailLocalPart(decodedToken.email) || name,
              ),
              link: link || '',
              institution: institution || 'OpenSpace',
              // Payload's email/password login is still on (the admin panel uses it), so a
              // shared password would let anyone log in as this user. Nobody needs to know it:
              // these users log in through Firebase
              password: randomBytes(32).toString('hex'),
            },
          })

          return Response.json(newUser, {})
        } catch (error) {
          console.error('Registration error:', error)
          return Response.json(
            {
              message: (error as Error).message || 'Failed to register user',
            },
            {
              status: 400
            },
          )
        }
      }),
    },
  ],
})
