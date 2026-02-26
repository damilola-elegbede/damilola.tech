import { put } from '@vercel/blob';
import { requireApiKey } from '@/lib/api-key-auth';
import { apiSuccess, Errors } from '@/lib/api-response';
import { logAdminEvent } from '@/lib/audit-server';
import { getClientIp } from '@/lib/rate-limit';
import type { ResumeGenerationLog } from '@/lib/types/resume-generation';

export const runtime = 'nodejs';

const ALLOWED_BLOB_HOSTS = [
  '.public.blob.vercel-storage.com',
  '.blob.vercel-storage.com',
];

function isValidBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    return ALLOWED_BLOB_HOSTS.some(host => parsed.hostname.endsWith(host));
  } catch {
    return false;
  }
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_APPLICATION_STATUSES = [
  'draft',
  'applied',
  'interviewing',
  'rejected',
  'offered',
  // Backward-compatible statuses used by existing internal data.
  'interview',
  'offer',
] as const;

export async function GET(req: Request, { params }: RouteParams) {
  const { id } = await params;
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(id);
  } catch {
    return Errors.badRequest('Invalid blob URL encoding');
  }

  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  // Validate URL is from allowed blob storage domain (SSRF protection)
  if (!isValidBlobUrl(decodedUrl)) {
    return Errors.badRequest('Invalid blob URL');
  }

  try {
    const response = await fetch(decodedUrl);
    if (!response.ok) {
      return Errors.notFound('Generation not found');
    }

    const data: ResumeGenerationLog = await response.json();

    // Log access with API context
    await logAdminEvent('admin_resume_generation_viewed', { generationUrl: decodedUrl }, ip, {
      accessType: 'api',
      apiKeyId: authResult.apiKey.id,
      apiKeyName: authResult.apiKey.name,
    });

    return apiSuccess(data);
  } catch (error) {
    console.error('[api/v1/resume-generations/[id]] Error:', error);
    return Errors.internalError('Failed to fetch generation');
  }
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const { id } = await params;
  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(id);
  } catch {
    return Errors.badRequest('Invalid blob URL encoding');
  }

  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  if (!isValidBlobUrl(decodedUrl)) {
    return Errors.badRequest('Invalid blob URL');
  }

  let updates: {
    applicationStatus?: unknown;
    appliedDate?: unknown;
    notes?: unknown;
  };
  try {
    const parsedUpdates = await req.json();
    if (typeof parsedUpdates !== 'object' || parsedUpdates === null || Array.isArray(parsedUpdates)) {
      return Errors.badRequest('Invalid request body. Expected a JSON object.');
    }
    updates = parsedUpdates;
  } catch {
    return Errors.badRequest('Invalid JSON body.');
  }

  const { applicationStatus, appliedDate, notes } = updates;

  if (applicationStatus === undefined && appliedDate === undefined && notes === undefined) {
    return Errors.badRequest('At least one field (applicationStatus, appliedDate, notes) must be provided.');
  }

  if (
    applicationStatus !== undefined &&
    (typeof applicationStatus !== 'string' ||
      !VALID_APPLICATION_STATUSES.includes(applicationStatus as typeof VALID_APPLICATION_STATUSES[number]))
  ) {
    return Errors.validationError(
      'Invalid applicationStatus. Use: applied, interviewing, rejected, offered, or draft.'
    );
  }

  if (appliedDate !== undefined && (typeof appliedDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(appliedDate))) {
    return Errors.validationError('Invalid appliedDate format. Use YYYY-MM-DD.');
  }

  if (typeof appliedDate === 'string') {
    const [year, month, day] = appliedDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day);

    if (
      dateObj.getFullYear() !== year ||
      dateObj.getMonth() !== month - 1 ||
      dateObj.getDate() !== day
    ) {
      return Errors.validationError('Invalid date.');
    }
  }

  if (notes !== undefined && typeof notes !== 'string') {
    return Errors.validationError('Invalid notes. Expected a string.');
  }

  try {
    const response = await fetch(decodedUrl);
    if (!response.ok) {
      return Errors.notFound('Generation not found');
    }

    const data: ResumeGenerationLog = await response.json();

    if (applicationStatus !== undefined) {
      data.applicationStatus = applicationStatus as ResumeGenerationLog['applicationStatus'];
    }
    if (appliedDate !== undefined) {
      data.appliedDate = appliedDate;
    }
    if (notes !== undefined) {
      data.notes = notes;
    }

    const urlObj = new URL(decodedUrl);
    const blobPath = urlObj.pathname.replace(/^\//, '');
    if (!blobPath.startsWith('damilola.tech/resume-generations/')) {
      return Errors.badRequest('Invalid blob path');
    }

    await put(blobPath, JSON.stringify(data, null, 2), {
      access: 'public',
      contentType: 'application/json',
      allowOverwrite: true,
    });

    await logAdminEvent('api_resume_generation_status_updated', {
      generationUrl: decodedUrl,
      updates: {
        applicationStatus,
        appliedDate,
        notes: notes ? String(notes).slice(0, 200) : undefined,
      },
    }, ip, {
      accessType: 'api',
      apiKeyId: authResult.apiKey.id,
      apiKeyName: authResult.apiKey.name,
    });

    return apiSuccess(data);
  } catch (error) {
    console.error('[api/v1/resume-generations/[id]] PATCH error:', error);
    return Errors.internalError('Failed to update generation');
  }
}
