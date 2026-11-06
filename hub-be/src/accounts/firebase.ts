import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import fs from 'fs'
import path from 'path'

// The Firebase admin key, relative to where the server runs (hub-be/)
const SERVICE_ACCOUNT_FILE =
  process.env.FIREBASE_SERVICE_ACCOUNT_FILE || 'config/authentication-4b8de-firebase-adminsdk.json'

// Firebase admin auth, set up on first use. The key is read from disk at runtime rather than
// imported, so builds don't need it and it never ends up in the build output
export const firebaseAuth = () => {
  if (!getApps().length) {
    const file = path.resolve(SERVICE_ACCOUNT_FILE)
    if (!fs.existsSync(file)) {
      throw new Error(
        `Firebase admin key not found at ${file}. Copy it there, or set FIREBASE_SERVICE_ACCOUNT_FILE`,
      )
    }
    const serviceAccount = JSON.parse(fs.readFileSync(file, 'utf8')) as ServiceAccount
    initializeApp({ credential: cert(serviceAccount) })
  }
  return getAuth()
}
