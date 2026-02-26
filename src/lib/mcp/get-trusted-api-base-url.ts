/**
 * Returns a trusted base URL for server-to-server requests.
 *
 * Security note: do NOT derive this from request headers or req.url in production,
 * as that can be influenced by Host header spoofing.
 */
export function getTrustedApiBaseUrl(): string {
  const explicit = process.env.API_BASE_URL;
  if (explicit && explicit.trim()) {
    return explicit.trim().replace(/\/$/, '');
  }

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && vercelUrl.trim()) {
    const normalized = vercelUrl.trim();
    const withProtocol = normalized.startsWith('http://') || normalized.startsWith('https://')
      ? normalized
      : `https://${normalized}`;
    return withProtocol.replace(/\/$/, '');
  }

  // Safe local/dev fallback.
  return 'http://localhost';
}
