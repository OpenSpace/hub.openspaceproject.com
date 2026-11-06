import { GlobalConfig } from 'payload'

export const SiteConfig: GlobalConfig = {
  slug: 'site-config',
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'config',
      type: 'json',
      required: true,
    },
  ],
}
