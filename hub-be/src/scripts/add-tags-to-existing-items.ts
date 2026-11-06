// import payload from 'payload'

import { Payload } from "payload"

const addTagsToExistingItems = async (payload:Payload) => {
  // Get all items
  const items = await payload.find({
    collection: 'items',
    limit: 1000, // Adjust based on your needs
  })

  for (const item of items.docs) {
    const tags = []

    // Add OpenSpace Version tag
    if (item.openspaceVersion) {
      const versionTag = await payload.find({
        collection: 'tags',
        where: {
          type: { equals: 'openspaceVersion' },
          name: { equals: item.openspaceVersion },
        },
      })
      if (versionTag.docs.length > 0) {
        tags.push(versionTag.docs[0].id)
      }
    }

    // Add License tag
    if (item.license) {
      const licenseTag = await payload.find({
        collection: 'tags',
        where: {
          type: { equals: 'license' },
          name: { equals: item.license },
        },
      })
      if (licenseTag.docs.length > 0) {
        tags.push(licenseTag.docs[0].id)
      }
    }

    // Add Item Type tag
    if (item.type) {
      const typeTag = await payload.find({
        collection: 'tags',
        where: {
          type: { equals: 'itemType' },
          name: { equals: item.type },
        },
      })
      if (typeTag.docs.length > 0) {
        tags.push(typeTag.docs[0].id)
      }
    }

    // Update item with new tags
    await payload.update({
      collection: 'items',
      id: item.id,
      data: {
        tags: [...new Set([...(item.tags || []), ...tags])],
      },
    })
  }
}

// // Run the script
// addTagsToExistingItems()
//   .then(() => {
//     console.log('Tags added to existing items successfully')
//     process.exit(0)
//   })
//   .catch((err) => {
//     console.error('Error adding tags to existing items:', err)
//     process.exit(1)
//   })

export default addTagsToExistingItems
