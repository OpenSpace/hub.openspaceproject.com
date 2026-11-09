// Each type has its own upload checks and import code, so the types live in code; the
// site-config `itemTypes` list only picks which of them can be uploaded
export const ITEM_TYPES = [
  'asset',
  'profile',
  'recording',
  'webpanel',
  'config',
  'showcomposer',
  'package',
] as const

export type ItemType = (typeof ITEM_TYPES)[number]
