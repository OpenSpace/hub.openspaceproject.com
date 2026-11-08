import { withPayload } from '@payloadcms/next/withPayload'
import path from 'path'
import { fileURLToPath } from 'url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The repo root has its own lockfile, so pin the root Next 16 would otherwise pick
  turbopack: {
    root: path.dirname(fileURLToPath(import.meta.url)),
  },
  // The built frontend is copied into public/ (yarn build at the repo root). Any path that isn't
  // a Payload route (/api, /admin) or a file gets the frontend's index.html, so the frontend's
  // own router handles pages like /items/123
  async rewrites() {
    return {
      fallback: [{ source: '/:path*', destination: '/index.html' }],
    }
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
