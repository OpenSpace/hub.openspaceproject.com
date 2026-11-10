import {
  isAdmin,
  isAdminFieldLevel,
  isAdminOrSelf,
  isAdminOrSelfFieldLevel,
  requireOwnUploads,
} from '@/Access'
import { deleteUserContent, exportUserData } from '@/accounts/userData'
import { apiError } from '@/apiError'
import { verifyFirebaseToken } from '@/payload.config'
import {
  NAME_MAX_LENGTH,
  usernameKey,
  validateLink,
  validateUsername,
} from '@/validation/textFields'
import { withCors } from '@/withCors'
import type { CollectionConfig, Validate } from 'payload'

// The format rules, plus uniqueness: `unique` on the field only catches usernames that match
// exactly, so the stored lowercase copy is what is compared here. The unique index on that
// copy is the backstop; this check runs first so the error names `username`, the field the
// profile form actually has
const validateFreeUsername: Validate<string | null | undefined> = async (value, options) => {
  const format = validateUsername(value, options)
  if (format !== true) {
    return format
  }
  // The admin panel runs field validations in the browser as well, where there is no database
  // to ask; the same save is validated again on the server
  const payload = options.req?.payload
  if (!payload || typeof value !== 'string') {
    return true
  }
  const key = { usernameLower: { equals: usernameKey(value) } }
  const { totalDocs } = await payload.count({
    collection: 'users',
    where: options.id ? { and: [key, { id: { not_equals: options.id } }] } : key,
    req: options.req,
  })
  return totalDocs === 0 ? true : 'That username is already taken.'
}

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  // Users populated into other docs (item authors, favoritedBy) don't need their item lists
  defaultPopulate: { items: false, favorites: false },
  // auth: true,
  access: {
    // Hub users only use the API; the admin panel is for admins
    admin: ({ req: { user } }) => Boolean(user?.role?.includes('admin')),
    read: () => true,
    // Accounts are made by /api/register (local API, so this doesn't apply) or by admins;
    // Payload's default would let any logged-in user create users through /api/users
    create: isAdmin,
    update: isAdminOrSelf,
    // Users can delete their own account (GDPR); the hooks below erase what it owns
    delete: isAdminOrSelf,
  },
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        // New accounts are never admins unless an admin or the server's own code (e.g.
        // `npm run make-admin`) says so. Payload's first-user registration skips access checks,
        // so without this whoever registered first on a fresh hub could pick the admin role
        if (
          operation === 'create' &&
          req.payloadAPI !== 'local' &&
          !req.user?.role?.includes('admin')
        ) {
          data.role = ['user']
        }
        return data
      },
      requireOwnUploads({ thumbnail: 'media' }),
      ({ data }) => {
        // Keep the lowercased copy that `username`'s uniqueness is checked against in sync.
        // `data` holds the whole document here, so this also runs when something else changes
        if (typeof data?.username === 'string') {
          data.usernameLower = usernameKey(data.username)
        }
        return data
      },
    ],
    beforeValidate: [
      ({ data }) => {
        // Trim before the field rules are checked, so a stray space pasted into the profile
        // form isn't an error the user can't see
        if (typeof data?.username === 'string') {
          data.username = data.username.trim()
        }
        return data
      },
    ],
    beforeDelete: [deleteUserContent],
  },
  endpoints: [
    {
      path: '/me/export',
      method: 'get',
      handler: withCors(exportUserData),
    },
    // Password reset is off: Hub users log in through Firebase, and no email service is set
    // up, so Payload would write reset links to the server log. These replace Payload's own
    // routes (a collection's endpoints are matched first); admins reset passwords in the panel
    ...['/forgot-password', '/reset-password'].map((path) => ({
      path,
      method: 'post' as const,
      handler: withCors(async () =>
        apiError('Password reset is turned off. Ask an admin to reset your password.', 403),
      ),
    })),
  ],
  auth: {
    strategies: [
      {
        name: 'firebase',
        authenticate: async ({ headers, payload }) => {
          const authHeader = headers.get('authorization')
          if (!authHeader?.startsWith('Bearer ')) return { user: null }

          const idToken = authHeader.split('Bearer ')[1]

          try {
            // const decoded = await firebaseAdmin.auth().verifyIdToken(idToken)
            const decodedToken = await verifyFirebaseToken(idToken)

            const firebaseUID = decodedToken.uid
            const users = await payload.find({
              collection: 'users',
              where: { firebaseUID: { equals: firebaseUID } },
              depth: 0,
              limit: 1,
              pagination: false,
              joins: false,
            })

            if (users.docs.length > 0) {
              return {
                user: {
                  ...users.docs[0],
                  collection: 'users',
                }
              }
            } else {
              return { user: null }
            }
          } catch (err) {
            console.error('Firebase token error:', err)
            return { user: null }
          }
        },
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: ['admin', 'user'],
      defaultValue: 'user',
      hasMany: true,
      required: true,
      access: {
        read: isAdminOrSelfFieldLevel,
        // Admins only: otherwise users could make themselves admins
        update: isAdminFieldLevel,
      },
    },
    {
      name: 'email',
      type: 'text',
      unique: true,
      // required: true,
      // Profiles are public, but emails are only for the user themselves and admins. Only
      // admins change it: it comes from the Firebase login and is used to claim accounts
      access: {
        read: isAdminOrSelfFieldLevel,
        update: isAdminFieldLevel,
      },
    },
    {
      name: 'firebaseUID',
      type: 'text',
      // required: true,
      unique: true,
      // admin: {
      //   readOnly: true,
      // },
      access: {
        read: () => false,
        update: () => false,
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: NAME_MAX_LENGTH,
    },
    {
      name: 'username',
      type: 'text',
      required: true,
      unique: true,
      validate: validateFreeUsername,
    },
    {
      name: 'usernameLower',
      // `unique` indexes the field as well
      type: 'text',
      unique: true,
      admin: {
        readOnly: true,
        description:
          'Lowercased copy of username, kept in sync by a beforeChange hook, used to keep usernames unique without regard to case.',
        hidden: true,
      },
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'link',
      type: 'text',
      validate: validateLink,
    },
    {
      // How other people can reach this user. Separate from `email`, which comes from the login
      // and is used to claim accounts, so users can edit this one freely. Only logged-in users
      // can read it (the API leaves it out for anonymous requests), so scrapers don't get it
      name: 'contactEmail',
      type: 'email',
      access: {
        read: ({ req: { user } }) => Boolean(user),
      },
    },
    {
      name: 'institution',
      type: 'text',
      defaultValue: 'OpenSpace',
      required: true,
    },
    {
      name: 'slackHandle',
      type: 'text',
      defaultValue: '',
    },

    // Worked out from the items when read, only listing items the reader may see. The profile
    // page pages through /api/items instead, so these keep Payload's default limit
    {
      name: 'items',
      type: 'join',
      collection: 'items',
      on: 'author',
    },
    {
      name: 'favorites',
      type: 'join',
      collection: 'items',
      on: 'favoritedBy',
    },
  ],
}
