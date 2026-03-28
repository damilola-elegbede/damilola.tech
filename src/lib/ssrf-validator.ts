import { isIP } from 'node:net';

const BLOCKED_HOSTNAMES = new Set(['localhost', 'localhost.', '127.0.0.1', '0.0.0.0', '::1']);
const BLOCKED_IPV4_PATTERNS = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^224\./,
  /^240\./,
];
const MAX_REDIRECTS = 5;

let dnsLookup: typeof import('node:dns/promises').lookup | undefined;
let hasInitializedDnsLookup = false;

async function getDnsLookup() {
  if (!hasInitializedDnsLookup) {
    hasInitializedDnsLookup = true;
    try {
      const dns = await import('node:dns/promises');
      dnsLookup = dns.lookup;
    } catch {
      dnsLookup = undefined;
    }
  }

  return dnsLookup;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase();
}

export function isBlockedIpAddress(address: string): boolean {
  const version = isIP(address);

  if (version === 4) {
    return BLOCKED_IPV4_PATTERNS.some((pattern) => pattern.test(address));
  }

  if (version === 6) {
    const lower = address.toLowerCase();

    if (lower === '::1') return true;

    const mappedDotted = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mappedDotted) {
      return isBlockedIpAddress(mappedDotted[1]);
    }

    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      return isBlockedIpAddress(`${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`);
    }

    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(lower)) return true;
    if (lower === '::') return true;
  }

  return false;
}

export type ResolvedPublicUrl = {
  originalUrl: string;
  resolvedUrl: string;
  hostname: string;
  resolvedAddress: string;
};

export async function resolvePublicHttpUrl(urlString: string): Promise<ResolvedPublicUrl> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid URL format.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }

  const hostname = normalizeHostname(url.hostname);
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error('This URL is not allowed.');
  }

  const literalAddress = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  let resolvedAddress = literalAddress;
  if (!isIP(literalAddress)) {
    const lookup = await getDnsLookup();
    if (!lookup) {
      throw new Error('DNS resolution unavailable - URL fetching disabled for security.');
    }

    let results: Awaited<ReturnType<typeof lookup>>;
    try {
      results = await lookup(hostname, { all: true });
    } catch {
      throw new Error('This URL is not allowed.');
    }

    const addresses = Array.isArray(results) ? results : [results];
    if (addresses.length === 0) {
      throw new Error('This URL is not allowed.');
    }

    if (addresses.some((entry) => isBlockedIpAddress(entry.address))) {
      throw new Error('This URL is not allowed.');
    }

    const preferred = addresses.find((entry) => entry.family === 4) ?? addresses[0];
    resolvedAddress = preferred.address;
  }

  if (isBlockedIpAddress(resolvedAddress)) {
    throw new Error('This URL is not allowed.');
  }

  const fetchUrl = new URL(url.toString());
  fetchUrl.hostname = resolvedAddress;

  return {
    originalUrl: url.toString(),
    resolvedUrl: fetchUrl.toString(),
    hostname,
    resolvedAddress,
  };
}

export async function fetchWithResolvedPublicIp(
  url: string,
  options: {
    maxSize: number;
    timeout: number;
    userAgent: string;
    redirectCount?: number;
  }
): Promise<string> {
  const { maxSize, timeout, userAgent } = options;
  const redirectCount = options.redirectCount ?? 0;

  if (redirectCount >= MAX_REDIRECTS) {
    throw new Error('Too many redirects');
  }

  const resolved = await resolvePublicHttpUrl(url);
  const response = await fetch(resolved.resolvedUrl, {
    headers: {
      Host: resolved.hostname,
      'User-Agent': userAgent,
    },
    signal: AbortSignal.timeout(timeout),
    redirect: 'manual',
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      const redirectUrl = new URL(location, resolved.originalUrl).toString();
      return fetchWithResolvedPublicIp(redirectUrl, {
        maxSize,
        timeout,
        userAgent,
        redirectCount: redirectCount + 1,
      });
    }
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    throw new Error('Response too large');
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.length;
      if (totalSize > maxSize) {
        throw new Error('Response too large');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const decoder = new TextDecoder('utf-8', { fatal: false });
  const textParts = chunks.map((chunk, index) =>
    decoder.decode(chunk, { stream: index < chunks.length - 1 })
  );
  textParts.push(decoder.decode());

  return textParts.join('');
}
