import { cookies } from 'next/headers';
import { list } from '@vercel/blob';
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth';
import { logger, logColdStartIfNeeded } from '@/lib/logger';
import { withRequestContext, createRequestContext } from '@/lib/request-context';

export const runtime = 'nodejs';

const CHATS_PREFIX = 'damilola.tech/chats/';

interface ChatSummary {
  id: string;
  pathname: string;
  sessionId: string;
  environment: string;
  timestamp: string;
  size: number;
  url: string;
}

export async function GET(req: Request) {
  const ctx = createRequestContext(req, '/api/admin/chats');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/admin/chats', { method: 'GET' });

    // Verify authentication
    const cookieStore = await cookies();
    const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
    if (!token || !(await verifyToken(token))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
      const { searchParams } = new URL(req.url);
      const environment = searchParams.get('env') || process.env.VERCEL_ENV || 'production';
      const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
      const cursor = searchParams.get('cursor') || undefined;

      const prefix = `${CHATS_PREFIX}${environment}/`;
      const result = await list({ prefix, cursor, limit });

      const chats: ChatSummary[] = result.blobs
        // Filter out zero-byte files
        .filter((blob) => blob.size > 0)
        .map((blob) => {
          // Extract info from pathname: damilola.tech/chats/{env}/{timestamp}-{uuid}.json
          // Or legacy format: damilola.tech/chats/{env}/{uuid}.json
          const filename = blob.pathname.split('/').pop() || '';

          // Try new format: {timestamp}-{shortId}.json (8-char hex ID from archive route)
          const newFormatMatch = filename.match(
            /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)-([a-f0-9]{8})(?:-.+)?\.json$/i
          );

          // Try legacy format: just {uuid}.json
          const legacyFormatMatch = filename.match(/^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\.json$/);

          let sessionId = '';
          let timestamp = '';

          if (newFormatMatch) {
            sessionId = newFormatMatch[2];
            timestamp = newFormatMatch[1].replace(/-/g, (m, i) => i > 9 ? ':' : m).replace('Z', '.000Z');
          } else if (legacyFormatMatch) {
            sessionId = legacyFormatMatch[1].slice(0, 8); // Use first 8 chars of UUID
            // Use blob's uploadedAt as timestamp fallback
            timestamp = blob.uploadedAt?.toISOString() || '';
          }

          return {
            id: blob.pathname,
            pathname: blob.pathname,
            sessionId,
            environment,
            timestamp,
            size: blob.size,
            url: blob.url,
          };
        })
        // Filter out entries that couldn't be parsed
        .filter((chat) => chat.sessionId !== '');

      logger.request.completed('/api/admin/chats', ctx.startTime, {
        chatCount: chats.length,
      });

      return Response.json({
        chats,
        cursor: result.cursor,
        hasMore: result.hasMore,
      });
    } catch (error) {
      logger.request.failed('/api/admin/chats', ctx.startTime, error);
      return Response.json({ error: 'Failed to list chats' }, { status: 500 });
    }
  });
}
