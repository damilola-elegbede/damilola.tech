import { cookies } from 'next/headers';
import { list } from '@vercel/blob';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { logger, logColdStartIfNeeded } from '@/lib/logger';
import { withRequestContext, createRequestContext } from '@/lib/request-context';

export const runtime = 'nodejs';

const ASSESSMENTS_PREFIX = 'damilola.tech/fit-assessments/';

interface AssessmentSummary {
  id: string;
  pathname: string;
  assessmentId: string;
  environment: string;
  timestamp: string;
  size: number;
  url: string;
}

export async function GET(req: Request) {
  const ctx = createRequestContext(req, '/api/admin/fit-assessments');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/admin/fit-assessments', { method: 'GET' });

    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token || !(await verifyToken(token))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const { searchParams } = new URL(req.url);
      const environment = searchParams.get('env') || process.env.VERCEL_ENV || 'production';
      const limitParam = parseInt(searchParams.get('limit') || '50', 10);
      const limit = Math.max(1, Math.min(isNaN(limitParam) ? 50 : limitParam, 100));
      const cursor = searchParams.get('cursor') || undefined;

      const prefix = `${ASSESSMENTS_PREFIX}${environment}/`;
      const result = await list({ prefix, cursor, limit });

      const assessments: AssessmentSummary[] = result.blobs.map((blob) => {
        // Extract info from pathname: damilola.tech/fit-assessments/{env}/{timestamp}-{uuid}.json
        const filename = blob.pathname.split('/').pop() || '';
        const match = filename.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-f0-9]+)/);

        return {
          id: blob.pathname,
          pathname: blob.pathname,
          assessmentId: match?.[2] || '',
          environment,
          timestamp: match?.[1]?.replace(/T(\d{2})-(\d{2})-(\d{2})Z/, 'T$1:$2:$3Z') || '',
          size: blob.size,
          url: blob.url,
        };
      });

      logger.request.completed('/api/admin/fit-assessments', ctx.startTime, {
        assessmentCount: assessments.length,
      });

      return Response.json({
        assessments,
        cursor: result.cursor,
        hasMore: result.hasMore,
      });
    } catch (error) {
      logger.request.failed('/api/admin/fit-assessments', ctx.startTime, error);
      return Response.json({ error: 'Failed to list assessments' }, { status: 500 });
    }
  });
}
