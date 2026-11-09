import { apiFetch } from './api';

// A file inside a .zip asset bundle, recorded by the backend at upload
export interface BundleFile {
  path: string;
  size: number;
}

// Fetch the file list of a .zip asset bundle. Item queries leave it out (it can be large),
// so it is looked up by the bundle's unique stored filename. Resolves undefined when the
// bundle has no recorded contents (e.g. not backfilled yet) or the request fails
export const fetchBundleContents = async (filename: string): Promise<BundleFile[] | undefined> => {
  const params = new URLSearchParams({
    'where[filename][equals]': filename,
    'select[contents]': 'true',
    depth: '0',
    limit: '1',
  });
  try {
    const data = await apiFetch<{ docs?: { contents?: BundleFile[] }[] }>(
      `/api/asset-bundles?${params}`
    );
    return data.docs?.[0]?.contents ?? undefined;
  } catch {
    return undefined;
  }
};
