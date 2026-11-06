// hub-fe/src/utils/textUtils.ts

/**
 * Converts URLs in text to HTML anchor tags
 * @param text - The text containing URLs to convert
 * @returns The text with URLs converted to HTML anchor tags
 */
export function convertLinksToHtml(text: string): string {
  // Regular expression to match URLs
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Replace URLs with anchor tags
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
  });
}
