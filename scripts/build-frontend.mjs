// Builds the frontend for a given API address and copies it into the backend's public/ folder,
// for trying the hub on :3000 without editing any .env file. Usage:
//   node scripts/build-frontend.mjs http://localhost:3000
// The address is built into the frontend's JS, so run it again to switch addresses
import { spawnSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiUrl = process.argv[2]
if (!apiUrl || !/^https?:\/\//.test(apiUrl)) {
  console.error('Give the API address, e.g. node scripts/build-frontend.mjs http://localhost:3000')
  process.exit(1)
}

console.log(`Building the frontend for ${apiUrl}`)
// A shell is needed to find yarn on Windows
const build = spawnSync('yarn build', {
  cwd: path.join(root, 'hub-fe'),
  env: { ...process.env, VITE_PAYLOAD_API_URL: apiUrl },
  stdio: 'inherit',
  shell: true,
})
if (build.status !== 0) process.exit(build.status ?? 1)

const copy = spawnSync(process.execPath, [path.join(root, 'scripts', 'copy-frontend.mjs')], {
  stdio: 'inherit',
})
process.exit(copy.status ?? 1)
