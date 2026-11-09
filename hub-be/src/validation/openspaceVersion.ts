import type { FieldHook } from 'payload'
import { inSiteConfigList } from './siteConfigLists'

// Only the minor version counts: "0.21.1" -> "0.21"
export const toMinorVersion = (version: string) => version.trim().replace(/^(\d+\.\d+)\.\d+$/, '$1')

export const normalizeOpenspaceVersion: FieldHook = ({ value }) =>
  typeof value === 'string' ? toMinorVersion(value) : value

export const validateOpenspaceVersion = inSiteConfigList(
  'versions',
  (value) =>
    `"${value}" is not a recognized OpenSpace version. Add it to the site config versions list first.`,
)
