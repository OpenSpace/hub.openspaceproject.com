import { Access, FieldAccess, Payload, PayloadRequest, Where } from 'payload'
import { User } from '../payload-types'
// import { Access } from "payload/config";

export const isAdmin: Access = ({ req: { user } }) => {
  // Return true or false based on if the user has an admin role
  return Boolean(user?.role?.includes('admin'))
}

export const isAdminFieldLevel: FieldAccess = ({ req: { user } }) => {
  // Return true or false based on if the user has an admin role
  return Boolean(user?.role?.includes('admin'))
}
export const isAdminOrSelfFieldLevel: FieldAccess = ({ req: { user }, id, doc }) => {
  // Need to be logged in
  if (!user) {
    return false
  }
  // If user has role of 'admin'
  if (user.role?.includes('admin')) {
    return true
  }
  // `id` isn't passed when reading lists or populated relationships, so fall back to the doc's
  return user.id === (id ?? doc?.id)
}

export const isAdminOrSelf: Access = ({ req: { user } }) => {
  // Need to be logged in
  if (user) {
    // If user has role of 'admin'
    if (user.role?.includes('admin')) {
      return true
    }

    // If any other type of user, only provide access to themselves
    return {
      id: {
        equals: user.id,
      },
    }
  }

  // Reject everyone else
  return false
}

export const isAdminOrAuthor: Access = ({ req: { user } }) => {
  // Need to be logged in
  if (user) {
    // If user has role of 'admin'
    if (user.role?.includes('admin')) {
      return true
    }

    // Otherwise, only provide access to items they authored
    return {
      author: {
        equals: user.id,
      },
    }
  }

  // Reject everyone else
  return false
}

export const isLoggedIn: Access = ({ req: { user } }) => {
  // Return true if user is logged in, false if not
  return Boolean(user)
}

export const UPLOADS_DISABLED_MESSAGE = 'Uploading is currently disabled'

// A boolean switch in the site-config global; on unless it is explicitly false
const siteConfigSwitch = async (payload: Payload, key: 'upload' | 'signin'): Promise<boolean> => {
  const siteConfig = await payload.findGlobal({ slug: 'site-config', depth: 0 })
  return (siteConfig.config as Record<string, unknown> | null)?.[key] !== false
}

export const uploadsEnabled = (payload: Payload) => siteConfigSwitch(payload, 'upload')

export const SIGNIN_DISABLED_MESSAGE = 'Login and sign up are currently disabled'

// Whether new logins may register or claim a Hub account (existing sessions keep working)
export const signinEnabled = (payload: Payload) => siteConfigSwitch(payload, 'signin')

// Whether this request may upload: logged in, and uploads switched on (admins always may)
export const canUploadRequest = async (req: PayloadRequest): Promise<boolean> => {
  if (!req.user) {
    return false
  }
  if (req.user.role?.includes('admin')) {
    return true
  }
  return uploadsEnabled(req.payload)
}

// Create access for anything that adds uploaded content (items, media, asset bundles)
export const canUpload: Access = ({ req }) => canUploadRequest(req)

export const readPublishedOrOwn: Access = ({ req: { user } }) => {
  // Admins can read everything
  if (user?.role?.includes('admin')) {
    return true
  }

  // Logged-in users can read published items plus their own (any state)
  if (user) {
    const where: Where = {
      or: [{ state: { equals: 'published' } }, { author: { equals: user.id } }],
    }
    return where
  }

  // Anonymous users can only read published items
  const where: Where = {
    state: { equals: 'published' },
  }
  return where
}
