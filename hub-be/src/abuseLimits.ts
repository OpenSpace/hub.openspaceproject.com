import { executeAuthStrategies, getPayload, headersWithCors } from 'payload'

import type { PayloadRequest, SanitizedConfig } from 'payload'
import { apiError } from './apiError'

// Apache appends the address it got the request from, so only the last entry can't be forged.
// Undefined when not behind Apache (local development)
export const clientIp = (headers: Headers): string | undefined =>
  headers.get('x-forwarded-for')?.split(',').pop()?.trim() || undefined

// Allows `limit` requests per key in each `windowMs`. In memory, which works because pm2 runs
// a single process, and resets on restart
export const rateLimiter = (limit: number, windowMs: number) => {
  const windows = new Map<string, { start: number; count: number }>()
  return (key: string): boolean => {
    const now = Date.now()
    if (windows.size > 10000) {
      for (const [k, window] of windows) {
        if (now - window.start >= windowMs) windows.delete(k)
      }
    }
    const window = windows.get(key)
    if (!window || now - window.start >= windowMs) {
      windows.set(key, { start: now, count: 1 })
      return true
    }
    window.count++
    return window.count <= limit
  }
}

export const tooManyRequests = () =>
  apiError('Too many requests. Try again in a minute.', 429, { headers: { 'Retry-After': '60' } })

type RestHandler = (
  request: Request,
  args: { params: Promise<{ slug?: string[] }> },
) => Promise<Response>

const uploadCollections = /^\/api\/(media|asset-bundles)(\/|$)/
const uploadsInProgress = new Set<string>()

// Payload reads the whole request body before checking access, so for the upload collections
// check the login, and allow non-admins one upload at a time, before the body is read
export const limitUploads =
  (config: Promise<SanitizedConfig>, handler: RestHandler): RestHandler =>
  async (request, args) => {
    if (!uploadCollections.test(new URL(request.url).pathname)) {
      return handler(request, args)
    }

    const payload = await getPayload({ config })
    const { user } = await executeAuthStrategies({ headers: request.headers, payload })
    // Admins are trusted, and the admin panel sends several requests at once
    if (user?.role?.includes('admin')) {
      return handler(request, args)
    }

    const headers = headersWithCors({
      headers: new Headers(),
      req: { headers: request.headers, payload } as PayloadRequest,
    })
    if (!user) {
      return apiError('You must be logged in to upload', 401, { headers })
    }
    const key = `${user.collection}:${user.id}`
    if (uploadsInProgress.has(key)) {
      return apiError('Another upload is still in progress. Wait for it to finish.', 429, {
        headers,
      })
    }
    uploadsInProgress.add(key)
    try {
      return await handler(request, args)
    } finally {
      uploadsInProgress.delete(key)
    }
  }
