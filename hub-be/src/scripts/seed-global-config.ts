import { Payload } from "payload"
import { ITEM_TYPES } from "@/itemTypes"
import type { SiteConfig } from "@/payload-types"

// Site options for a fresh database. The tag seed creates a tag for each version, license and
// item type listed here
export const defaultSiteConfig = {
  upload: true,
  signin: true,
  showFavoriteCounts: false,
  showDownloadCounts: false,
  allowImport: false,
  versions: [
    "0.22",
    "0.21",
    "0.20"
  ],
  itemTypes: [...ITEM_TYPES],
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
} satisfies Omit<SiteConfig, 'id'>

const seedGlobalConfig = async (payload: Payload) => {
  await payload.updateGlobal({
    slug: 'site-config',
    data: defaultSiteConfig
  })
}

export default seedGlobalConfig
