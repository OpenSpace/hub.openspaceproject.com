import { headersWithCors } from 'payload'

import type { PayloadHandler, PayloadRequest } from 'payload'

export const withCors = (handler: PayloadHandler) => async (req: PayloadRequest) => {
  if (req.method === 'OPTIONS') {
    return new Response('', {
      headers: headersWithCors({ headers: new Headers(), req }),
      status: 200,
    })
  }

  const response = await handler(req)

  return new Response(response.body, {
    headers: headersWithCors({ headers: response.headers, req }),
    status: response.status,
    statusText: response.statusText,
  })
}
