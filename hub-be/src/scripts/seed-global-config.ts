import { Payload } from "payload"

// Site options for a fresh database. The tag seed creates a tag for each version, license and
// item type listed here, so this is the one place to update them
export const defaultSiteConfig = {
  upload: true,
  signin: true,
  showFavoriteCounts: false,
  showDownloadCounts: false,
  allowImport: false,
  versions: [
    "0.22.1",
    "0.22.0",
    "0.21.4",
    "0.20.1"
  ],
  itemTypes: [
    "asset",
    "profile",
    "recording",
    "webpanel",
    "config",
    "package",
    "showcomposer"
  ],
  licenses: [
    "CC BY",
    "CC BY-SA",
    "CC BY-NC",
    "CC BY-NC-SA",
    "CC BY-ND",
    "CC BY-NC-ND",
    "CC0",
    "MIT",
    "Apache",
    "GPL",
    "LGPL",
    "BSD",
    "Proprietary"
  ]
}

const seedGlobalConfig = async (payload: Payload) => {
  // Create or update the global config
  await payload.updateGlobal({
    slug: 'site-config',
    data: {
      config: defaultSiteConfig
    }
  })
}

export default seedGlobalConfig
