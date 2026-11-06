// Tell the hub an item was downloaded or imported, for its anonymous counters. Sends no
// credentials and no identifying info, and never throws: a failed count shouldn't get in the
// way of the download or import itself
export const trackItem = (itemId: string, kind: 'download' | 'import') => {
  fetch(`${import.meta.env.VITE_PAYLOAD_API_URL}/api/items/${itemId}/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind }),
  }).catch(() => {});
};
