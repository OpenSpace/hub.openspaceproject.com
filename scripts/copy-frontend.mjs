// Copy the built frontend (hub-fe/dist) into the backend's public/ folder, which Next.js serves.
// public/ only ever holds this build, so it is emptied first to drop files from older builds
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const from = path.join(root, 'hub-fe', 'dist')
const to = path.join(root, 'hub-be', 'public')

if (!fs.existsSync(path.join(from, 'index.html'))) {
  console.error(`No frontend build in ${from}. Run yarn build:fe first.`)
  process.exit(1)
}

fs.rmSync(to, { recursive: true, force: true })
fs.cpSync(from, to, { recursive: true })
console.log(`Copied the frontend build to ${to}`)
