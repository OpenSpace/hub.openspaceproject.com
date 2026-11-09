import { User } from 'firebase/auth';

const API_BASE = (import.meta.env.VITE_PAYLOAD_API_URL ?? '').replace(/\/+$/, '');

// Full address of an API path or of a stored file's `url` (both start with /api/)
export const apiUrl = (path: string) => `${API_BASE}/${path.replace(/^\/+/, '')}`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface PayloadErrorBody {
  errors?: { message?: string; data?: { errors?: { message?: string }[] } }[];
}

// The message of an error response: { errors: [{ message }] } from Payload and the hub's own
// endpoints, preferring a validation error's per-field messages
const readError = async (response: Response) => {
  const body: PayloadErrorBody | null = await response.json().catch(() => null);
  const error = body?.errors?.[0];
  const fieldMessages = error?.data?.errors?.map((e) => e.message).filter(Boolean) ?? [];
  return (
    (fieldMessages.length > 0 ? fieldMessages.join(' ') : error?.message) ||
    `Request failed with status ${response.status}`
  );
};

export type ApiOptions = Omit<RequestInit, 'body'> & {
  // Sends this Firebase user's login token
  user?: User | null;
  // FormData is sent as is, anything else as JSON
  body?: unknown;
};

// Calls the API and returns the JSON response; throws an ApiError with the server's message
export async function apiFetch<T = unknown>(
  path: string,
  { user, body, ...init }: ApiOptions = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  if (user) {
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
  }
  let requestBody: BodyInit | undefined;
  if (body instanceof FormData) {
    requestBody = body;
  } else if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
    requestBody = JSON.stringify(body);
  }

  const response = await fetch(apiUrl(path), { ...init, headers, body: requestBody });
  if (!response.ok) {
    throw new ApiError(await readError(response), response.status);
  }
  return response.json();
}

// Uploads a file to an upload collection (or its custom upload endpoint), with `data` as the
// document's other fields, and returns the new document's id
export async function uploadFile(
  path: string,
  file: File,
  data: Record<string, unknown>,
  user: User | null
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('_payload', JSON.stringify(data));
  const { doc } = await apiFetch<{ doc: { id: string } }>(path, {
    method: 'POST',
    body: formData,
    user,
  });
  return doc.id;
}
