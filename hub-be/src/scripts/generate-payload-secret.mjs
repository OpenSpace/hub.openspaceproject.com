// Generate a random PAYLOAD_SECRET. Plain Node rather than `payload run`, since the Payload
// config refuses to load without a secret.
//
//   npm run generate:payload-secret                     print a new secret
//   npm run generate:payload-secret -- --write [file]   put it in an env file (default .env)
//
// --write leaves an existing real secret alone unless --force is given: changing it logs out
// everyone signed in to the admin panel (Firebase logins are unaffected)
import { randomBytes } from 'crypto'
import fs from 'fs'

const PLACEHOLDER_SECRET = 'YOUR_SECRET_HERE'

const args = process.argv.slice(2)
const secret = randomBytes(32).toString('hex')

if (!args.includes('--write')) {
  console.log(secret)
  process.exit(0)
}

const fileArg = args[args.indexOf('--write') + 1]
const envFile = fileArg && !fileArg.startsWith('--') ? fileArg : '.env'
const contents = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : ''
const existing = contents.match(/^PAYLOAD_SECRET=(.*)$/m)?.[1].trim()

if (existing && existing !== PLACEHOLDER_SECRET && !args.includes('--force')) {
  console.error(
    `${envFile} already has a PAYLOAD_SECRET. Pass --force to replace it ` +
      '(this logs out everyone signed in to the admin panel).',
  )
  process.exit(1)
}

const updated =
  existing !== undefined
    ? contents.replace(/^PAYLOAD_SECRET=.*$/m, `PAYLOAD_SECRET=${secret}`)
    : `${contents}${contents && !contents.endsWith('\n') ? '\n' : ''}PAYLOAD_SECRET=${secret}\n`
fs.writeFileSync(envFile, updated)
console.log(`Wrote a new PAYLOAD_SECRET to ${envFile}`)
