// // import { Express, Request, Response } from 'express'
// import payload, { Endpoint } from 'payload'
// import { verifyFirebaseToken } from '../payload.config' // Import the Firebase token verification
// import { PayloadRequest, Payload } from 'payload'
// //  = async ({ req, res }) => {

// export function registerUserRoute(payload: Payload) {
//   const { express } = payload as typeof payload & { express: import('express').Express }

//   express.post('/api/register', async (req, res) => {
//     const { idToken, username, link, institution } = req.body

//     try {
//       const decodedToken = await verifyFirebaseToken(idToken)

//       // Check if user exists by Firebase UID
//       const existingUser = await payload.find({
//         collection: 'users',
//         where: {
//           firebaseUID: {
//             equals: decodedToken.uid,
//           },
//         },
//         depth: 0, // Only get the user data, not related collections
//       })

//       if (existingUser.docs.length > 0) {
//         return res.status(200).json(existingUser.docs[0])
//       }

//       // Create new user with Firebase data
//       const newUser = await payload.create({
//         collection: 'users',
//         data: {
//           email: decodedToken.email || '',
//           firebaseUID: decodedToken.uid,
//           name: decodedToken.name || '', // Optional: include name if available
//           role: ['user'], // Set default role
//           username: username || '',
//           link: link || 'www.example.com',
//           institution: institution || 'OpenSpace',
//         },
//       })

//       return res.status(201).json(newUser)
//     } catch (error) {
//       console.error('Registration error:', error)
//       return res.status(400).json({
//         message: (error as Error).message || 'Failed to register user',
//       })
//     }
//   })
// }
