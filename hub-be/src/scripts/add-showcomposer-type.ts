import { Payload } from 'payload'

// One-off: add the 'showcomposer' item type to the live site-config global's
// itemTypes list, without touching anything else already stored there (the
// full seed-global-config script would overwrite versions/licenses too, which
// may have since diverged from what's hardcoded in that script).
const addShowcomposerType = async (payload: Payload) => {
  const itemTypes = (await payload.findGlobal({ slug: 'site-config', depth: 0 })).itemTypes ?? []

  if (itemTypes.includes('showcomposer')) {
    console.log('showcomposer is already in itemTypes, nothing to do')
    return
  }

  await payload.updateGlobal({
    slug: 'site-config',
    data: { itemTypes: [...itemTypes, 'showcomposer'] },
  })

  console.log('Added showcomposer to site-config itemTypes')
}

export default addShowcomposerType
