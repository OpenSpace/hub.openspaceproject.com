// Dates are shown as ISO 8601 for every viewer. toLocaleDateString() follows the browser's UI
// language rather than the viewer's regional settings, so an English-language browser prints
// 11/9/2026 even for readers who parse that as 11 September.
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  // Built from the local parts instead of toISOString(), so the date doesn't jump a day for
  // viewers whose timezone offset moves the stored UTC timestamp across midnight.
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
