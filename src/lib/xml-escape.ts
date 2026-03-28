/**
 * Escape user-controlled strings before embedding in XML prompt tags.
 * Prevents prompt injection by neutralizing all 5 XML special characters.
 *
 * Escapes: & < > " '
 * Note: & must be replaced first to avoid double-escaping.
 */
export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
