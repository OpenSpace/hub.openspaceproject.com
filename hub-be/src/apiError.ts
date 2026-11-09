// An error from the hub's own endpoints, in the same JSON shape as Payload's: { errors: [{ message }] }
export const apiError = (message: string, status: number, init?: Omit<ResponseInit, 'status'>) =>
  Response.json({ errors: [{ message }] }, { ...init, status })
