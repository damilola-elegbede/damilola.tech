import { isIP } from 'node:net';

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

const BLOCKED_HOSTNAMES = ['localhost', 'localhost.', '127.0.0.1', '0.0.0.0', '::1'];

const JD_KEYWORDS = [
  'responsibilities',
  'qualifications',
  'requirements',
  'experience',
  'skills',
  'job description',
  'position',
  'duties',
  'about the role',
  "what you'll do",
  'who you are',
  "what we're looking for",
  'minimum requirements',
  'preferred qualifications',
  'about this job',
  'the role',
  'your responsibilities',
  'must have',
  'nice to have',
  'benefits',
  'compensation',
  'salary',
  'apply',
];

const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^0\./,
  /^224\./,
  /^240\./,
];

const MIN_JD_KEYWORDS = 2;
const MIN_EXTRACTED_CONTENT_LENGTH = 100;
const MAX_REDIRECTS = 5;

export const URL_FETCH_TIMEOUT = 10000;
export const MAX_RESPONSE_SIZE = 1024 * 1024;

export class JobDescriptionInputError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function isUrlInput(input: string): boolean {
  return /^https?:\/\//i.test(input.trim());
}

export function extractTextFromHtml(html: string): string {
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  text = text.replace(/<[^>]+>/g, ' ');
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&ndash;/g, '-')
    .replace(/&mdash;/g, '-')
    .replace(/&#\d+;/g, (match) => {
      const code = parseInt(match.slice(2, -1), 10);
      return String.fromCharCode(code);
    });

  return text.replace(/\s+/g, ' ').trim();
}

function looksLikeJobDescription(content: string): boolean {
  const lowerContent = content.toLowerCase();
  let matchCount = 0;

  for (const keyword of JD_KEYWORDS) {
    if (lowerContent.includes(keyword.toLowerCase())) {
      matchCount++;
      if (matchCount >= MIN_JD_KEYWORDS) {
        return true;
      }
    }
  }

  return false;
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(address));
  }

  if (version === 6) {
    const lower = address.toLowerCase();

    if (lower === '::1') return true;

    const mappedDotted = lower.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    if (mappedDotted && PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(mappedDotted[1]))) {
      return true;
    }

    const mappedHex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (mappedHex) {
      const hi = parseInt(mappedHex[1], 16);
      const lo = parseInt(mappedHex[2], 16);
      const ipv4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
      if (PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(ipv4))) {
        return true;
      }
    }

    if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(lower)) return true;

    return false;
  }

  return false;
}

async function validateUrlForSsrf(urlString: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return 'Invalid URL format.';
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    return 'Only HTTP and HTTPS URLs are supported.';
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return 'This URL is not allowed.';
  }

  if (hostname === '169.254.169.254') {
    return 'This URL is not allowed.';
  }

  const ipAddress = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;

  if (isIP(ipAddress)) {
    if (isPrivateIp(ipAddress)) {
      return 'This URL is not allowed.';
    }
    return null;
  }

  try {
    const lookup = await getDnsLookup();
    if (!lookup) {
      return 'DNS resolution unavailable - URL fetching disabled for security.';
    }

    const results = await lookup(hostname, { all: true });
    const addresses = results.map((result) => result.address);
    if (addresses.some(isPrivateIp)) {
      return 'This URL is not allowed.';
    }
  } catch {
    return 'This URL is not allowed.';
  }

  return null;
}

async function fetchWithSizeLimit(
  url: string,
  maxSize: number,
  timeout: number,
  userAgent: string,
  redirectCount = 0
): Promise<string> {
  if (redirectCount >= MAX_REDIRECTS) {
    throw new Error('Too many redirects');
  }

  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent },
    signal: AbortSignal.timeout(timeout),
    redirect: 'manual',
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (location) {
      const redirectUrl = new URL(location, url).href;
      const redirectError = await validateUrlForSsrf(redirectUrl);
      if (redirectError) {
        throw new Error(`Redirect blocked: ${redirectError}`);
      }
      return fetchWithSizeLimit(redirectUrl, maxSize, timeout, userAgent, redirectCount + 1);
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

export async function resolveJobDescriptionInput(
  input: string,
  userAgent: string
): Promise<{ text: string; inputType: 'text' | 'url'; extractedUrl?: string }> {
  if (!isUrlInput(input)) {
    return { text: input, inputType: 'text' };
  }

  const urlToFetch = input.trim();
  const ssrfError = await validateUrlForSsrf(urlToFetch);
  if (ssrfError) {
    throw new JobDescriptionInputError(`${ssrfError} Please provide the job description text directly.`);
  }

  try {
    const html = await fetchWithSizeLimit(urlToFetch, MAX_RESPONSE_SIZE, URL_FETCH_TIMEOUT, userAgent);
    const textContent = extractTextFromHtml(html);

    if (textContent.length < MIN_EXTRACTED_CONTENT_LENGTH) {
      throw new JobDescriptionInputError(
        'Could not extract enough job description content from the URL. Please provide the text directly.'
      );
    }

    if (!looksLikeJobDescription(textContent)) {
      throw new JobDescriptionInputError(
        'The URL does not appear to contain a job description. Please provide the job description text directly.'
      );
    }

    return {
      text: textContent,
      inputType: 'url',
      extractedUrl: urlToFetch,
    };
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    if (message.includes('Redirect blocked')) {
      throw new JobDescriptionInputError(
        'The URL redirected to a blocked destination. Please provide the job description text directly.'
      );
    }
    if (message.includes('Response too large')) {
      throw new JobDescriptionInputError('The page is too large to process. Please provide the job description text directly.');
    }

    throw new JobDescriptionInputError(
      'Could not fetch the job posting. The site may be unavailable or blocking access. Please provide the job description text directly.'
    );
  }
}
