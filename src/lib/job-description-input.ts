import { fetchWithResolvedPublicIp } from '@/lib/ssrf-validator';

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

const MIN_JD_KEYWORDS = 2;
const MIN_EXTRACTED_CONTENT_LENGTH = 100;

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

async function fetchJobDescriptionHtml(
  url: string,
  userAgent: string
): Promise<string> {
  try {
    return await fetchWithResolvedPublicIp(url, {
      maxSize: MAX_RESPONSE_SIZE,
      timeout: URL_FETCH_TIMEOUT,
      userAgent,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    if (
      message === 'Invalid URL format.' ||
      message === 'Only HTTP and HTTPS URLs are supported.' ||
      message === 'This URL is not allowed.' ||
      message === 'DNS resolution unavailable - URL fetching disabled for security.'
    ) {
      throw new JobDescriptionInputError(`${message} Please provide the job description text directly.`);
    }

    if (message.includes('Response too large')) {
      throw new JobDescriptionInputError('The page is too large to process. Please provide the job description text directly.');
    }

    if (message.includes('Too many redirects')) {
      throw new JobDescriptionInputError('The URL redirected too many times. Please provide the job description text directly.');
    }

    throw error;
  }
}

export function resolvePreFetchedJobDescription(
  content: string,
  sourceUrl: string
): { text: string; inputType: 'content'; extractedUrl: string } {
  const looksLikeHtml = /<[a-z][\s\S]*?>/i.test(content);
  const textContent = looksLikeHtml
    ? extractTextFromHtml(content)
    : content.replace(/\s+/g, ' ').trim();

  if (textContent.length < MIN_EXTRACTED_CONTENT_LENGTH) {
    throw new JobDescriptionInputError(
      `Pre-fetched content too short (${textContent.length} chars, minimum ${MIN_EXTRACTED_CONTENT_LENGTH} required).`
    );
  }

  if (!looksLikeJobDescription(textContent)) {
    throw new JobDescriptionInputError(
      'Pre-fetched content does not appear to be a job description.'
    );
  }

  return {
    text: textContent,
    inputType: 'content',
    extractedUrl: sourceUrl,
  };
}

export async function resolveJobDescriptionInput(
  input: string,
  userAgent: string
): Promise<{ text: string; inputType: 'text' | 'url'; extractedUrl?: string }> {
  if (!isUrlInput(input)) {
    return { text: input, inputType: 'text' };
  }

  const urlToFetch = input.trim();

  try {
    const html = await fetchJobDescriptionHtml(urlToFetch, userAgent);
    const textContent = extractTextFromHtml(html);

    if (textContent.length < MIN_EXTRACTED_CONTENT_LENGTH) {
      throw new JobDescriptionInputError(
        `Content too short (${textContent.length} chars, minimum ${MIN_EXTRACTED_CONTENT_LENGTH} required). Please provide the job description text directly.`
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
    if (message.includes('Response too large')) {
      throw new JobDescriptionInputError('The page is too large to process. Please provide the job description text directly.');
    }

    throw new JobDescriptionInputError(
      'Could not fetch the job posting. The site may be unavailable or blocking access. Please provide the job description text directly.'
    );
  }
}
