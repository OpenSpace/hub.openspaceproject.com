import { withPayload } from '@payloadcms/next/withPayload'
import path from 'path'
import { fileURLToPath } from 'url'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // npm workspaces install the packages, including next, in the repo root's node_modules
  turbopack: {
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  },
  // The built frontend is copied into public/ (npm run build at the repo root). Any path that isn't
  // a Payload route (/api, /admin) or a file gets the frontend's index.html, so the frontend's
  // own router handles pages like /items/123
  async rewrites() {
    return {
      fallback: [{ source: '/:path*', destination: '/index.html' }],
    }
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
