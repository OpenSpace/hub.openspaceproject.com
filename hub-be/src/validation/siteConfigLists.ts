import type { Validate } from 'payload'

type SiteConfigList = 'versions' | 'licenses' | 'itemTypes'

// Checks a value against one of the site-config lists. The value an item already has passes
// too, so taking an option off the list doesn't block edits of the items that use it
export const inSiteConfigList =
  (list: SiteConfigList, notListed: (value: string) => string): Validate<string | null | undefined> =>
  async (value, { req, required, previousValue }) => {
    if (!value) {
      return required ? 'This field is required.' : true
    }
    if (value === previousValue) {
      return true
    }
    const siteConfig = await req.payload.findGlobal({ slug: 'site-config', depth: 0, req })
    const options: string[] = siteConfig[list] ?? []
    return options.includes(value) || notListed(value)
  }

export const validateLicense = inSiteConfigList(
  'licenses',
  (value) => `"${value}" is not one of the site's licenses. Add it to the site config licenses list first.`,
)

export const validateItemType = inSiteConfigList(
  'itemTypes',
  (value) => `"${value}" items can't be uploaded. Add the type to the site config item types first.`,
)
