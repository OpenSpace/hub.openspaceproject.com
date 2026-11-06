import type { Validate } from 'payload'

// Validates against the live `versions` list in the site-config global,
// so new OpenSpace versions can be added without a code change/deploy.
export const validateOpenspaceVersion: Validate<string | null | undefined> = async (
  value,
  { req, required },
) => {
  if (!value) {
    return required ? 'This field is required.' : true
  }

  const siteConfig = await req.payload.findGlobal({ slug: 'site-config' })
  const config = siteConfig?.config as { versions?: string[] } | undefined
  const versions: string[] = config?.versions || []

  if (!versions.includes(value)) {
    return `"${value}" is not a recognized OpenSpace version. Add it to the site config versions list first.`
  }

  return true
}
