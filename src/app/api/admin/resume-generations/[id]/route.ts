import { put } from '@vercel/blob';
import { cookies } from 'next/headers';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import type { ResumeGenerationLog, ApplicationStatus } from '@/lib/types/resume-generation';
import { logger, logColdStartIfNeeded } from '@/lib/logger';
import { withRequestContext, createRequestContext } from '@/lib/request-context';

// Use Node.js runtime for blob operations
export const runtime = 'nodejs';

// Allowed blob storage domain pattern
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

export async function GET(req: Request, { params }: RouteParams) {
  const ctx = createRequestContext(req, '/api/admin/resume-generations/[id]');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/admin/resume-generations/[id]', { method: 'GET' });

    const { id } = await params;
    const decodedUrl = decodeURIComponent(id);

    // Verify admin authentication
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!adminToken || !(await verifyToken(adminToken))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate URL is from allowed blob storage domain (SSRF protection)
    if (!isValidBlobUrl(decodedUrl)) {
      return Response.json({ error: 'Invalid blob URL' }, { status: 400 });
    }

    try {
      // Fetch the generation data from the blob URL
      const response = await fetch(decodedUrl);
      if (!response.ok) {
        return Response.json({ error: 'Generation not found' }, { status: 404 });
      }

      const data: ResumeGenerationLog = await response.json();

      logger.request.completed('/api/admin/resume-generations/[id]', ctx.startTime);
      return Response.json(data);
    } catch (error) {
      logger.request.failed('/api/admin/resume-generations/[id]', ctx.startTime, error);
      return Response.json(
        { error: 'Failed to fetch generation' },
        { status: 500 }
      );
    }
  });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const ctx = createRequestContext(req, '/api/admin/resume-generations/[id]');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/admin/resume-generations/[id]', { method: 'PATCH' });

    const { id } = await params;
    const decodedUrl = decodeURIComponent(id);

    // Verify admin authentication
    const cookieStore = await cookies();
    const adminToken = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!adminToken || !(await verifyToken(adminToken))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate URL is from allowed blob storage domain (SSRF protection)
    if (!isValidBlobUrl(decodedUrl)) {
      return Response.json({ error: 'Invalid blob URL' }, { status: 400 });
    }

    try {
    const updates = await req.json();
    const { applicationStatus, appliedDate, notes } = updates;

    // Validate appliedDate if provided
    if (appliedDate !== undefined) {
      if (typeof appliedDate !== 'string' || Number.isNaN(Date.parse(appliedDate))) {
        return Response.json({ error: 'Invalid applied date' }, { status: 400 });
      }
    }

    // Validate notes if provided
    if (notes !== undefined && typeof notes !== 'string') {
      return Response.json({ error: 'Invalid notes' }, { status: 400 });
    }

    // Validate applicationStatus if provided
    const validStatuses: ApplicationStatus[] = ['draft', 'applied', 'interview', 'offer', 'rejected'];
    if (applicationStatus && !validStatuses.includes(applicationStatus)) {
      return Response.json({ error: 'Invalid application status' }, { status: 400 });
    }

    // Fetch current data
    const response = await fetch(decodedUrl);
    if (!response.ok) {
      return Response.json({ error: 'Generation not found' }, { status: 404 });
    }

    const data: ResumeGenerationLog = await response.json();

    // Apply updates
    if (applicationStatus !== undefined) {
      data.applicationStatus = applicationStatus;
    }
    if (appliedDate !== undefined) {
      data.appliedDate = appliedDate;
    }
    if (notes !== undefined) {
      data.notes = notes;
    }

      // Extract blob path from URL to save back to same location
      // URL format: https://xxxxx.public.blob.vercel-storage.com/damilola.tech/resume-generations/...
      const urlObj = new URL(decodedUrl);
      const blobPath = urlObj.pathname.replace(/^\//, '');

      // Validate blob path starts with expected prefix (prevent path traversal)
      if (!blobPath.startsWith('damilola.tech/resume-generations/')) {
        return Response.json({ error: 'Invalid blob path' }, { status: 400 });
      }

      // Save updated data back to blob
      const blob = await put(blobPath, JSON.stringify(data, null, 2), {
        access: 'public',
        contentType: 'application/json',
        allowOverwrite: true,
      });

      logger.request.completed('/api/admin/resume-generations/[id]', ctx.startTime);
      return Response.json({
        success: true,
        url: blob.url,
        data,
      });
    } catch (error) {
      logger.request.failed('/api/admin/resume-generations/[id]', ctx.startTime, error);
      return Response.json(
        { error: 'Failed to update generation' },
        { status: 500 }
      );
    }
  });
}
