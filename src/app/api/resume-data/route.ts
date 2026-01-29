import { fetchAllContent } from '@/lib/blob';
import { logger, logColdStartIfNeeded } from '@/lib/logger';
import { withRequestContext, createRequestContext } from '@/lib/request-context';

// Use Node.js runtime (not edge) to allow local file fallback in development
export const runtime = 'nodejs';

/**
 * GET /api/resume-data
 *
 * Returns the parsed resume data from resume-full.json for PDF generation.
 */
export async function GET(req: Request) {
  const ctx = createRequestContext(req, '/api/resume-data');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/resume-data', { method: 'GET' });

    try {
      const content = await fetchAllContent();

      if (!content.resume) {
        logger.request.failed('/api/resume-data', ctx.startTime, new Error('Resume data not available'));
        return Response.json(
          { error: 'Resume data not available.' },
          { status: 503 }
        );
      }

      const resumeData = JSON.parse(content.resume);

      logger.request.completed('/api/resume-data', ctx.startTime);
      return Response.json(resumeData);
    } catch (error) {
      logger.request.failed('/api/resume-data', ctx.startTime, error);
      return Response.json(
        { error: 'Failed to load resume data.' },
        { status: 503 }
      );
    }
  });
}
