import { cookies } from 'next/headers';
import { logAdminEvent } from '@/lib/audit-server';
import { getClientIp } from '@/lib/rate-limit';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { logger, logColdStartIfNeeded } from '@/lib/logger';
import { withRequestContext, createRequestContext } from '@/lib/request-context';

export const runtime = 'nodejs';

// Validate that URL belongs to our Vercel Blob storage
function isValidBlobUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return (
      url.protocol === 'https:' &&
      url.hostname.endsWith('.blob.vercel-storage.com') &&
      url.pathname.includes('/damilola.tech/fit-assessments/')
    );
  } catch {
    return false;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = createRequestContext(req, '/api/admin/fit-assessments/[id]');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/admin/fit-assessments/[id]', { method: 'GET' });

    const ip = getClientIp(req);

    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token || !(await verifyToken(token))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const { id } = await params;
      const blobUrl = decodeURIComponent(id);

      // Validate URL to prevent SSRF attacks
      if (!isValidBlobUrl(blobUrl)) {
        return Response.json({ error: 'Invalid assessment URL' }, { status: 400 });
      }

      const response = await fetch(blobUrl);
      if (!response.ok) {
        return Response.json({ error: 'Assessment not found' }, { status: 404 });
      }

      const data = await response.json();

      // Log assessment access
      await logAdminEvent('admin_assessment_viewed', { assessmentUrl: blobUrl }, ip);

      logger.request.completed('/api/admin/fit-assessments/[id]', ctx.startTime);
      return Response.json(data);
    } catch (error) {
      logger.request.failed('/api/admin/fit-assessments/[id]', ctx.startTime, error);
      return Response.json({ error: 'Failed to fetch assessment' }, { status: 500 });
    }
  });
}
