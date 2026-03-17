/**
 * Escape user-controlled strings before embedding in XML prompt tags.
 * Prevents prompt injection by neutralizing XML special characters.
 */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
