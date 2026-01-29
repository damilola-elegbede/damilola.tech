import { fetchFitExamples } from '@/lib/blob';
import { logger, logColdStartIfNeeded } from '@/lib/logger';
import { withRequestContext, createRequestContext } from '@/lib/request-context';

// Use Node.js runtime to allow local file fallback in development
export const runtime = 'nodejs';

export async function GET(req: Request) {
  const ctx = createRequestContext(req, '/api/fit-examples');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/fit-examples', { method: 'GET' });

    try {
      const examples = await fetchFitExamples();
      logger.request.completed('/api/fit-examples', ctx.startTime);
      return Response.json(examples);
    } catch (error) {
      logger.request.failed('/api/fit-examples', ctx.startTime, error);
      return new Response(
        JSON.stringify({ error: 'Failed to load examples' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  });
}
