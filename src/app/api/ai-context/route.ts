import { NextResponse } from 'next/server';
import { fetchAiContext } from '@/lib/blob';
import { parseAiContext } from '@/lib/parse-ai-context';
import type { AiContext } from '@/types';
import { logger, logColdStartIfNeeded } from '@/lib/logger';
import { withRequestContext, createRequestContext } from '@/lib/request-context';

export const runtime = 'nodejs';

export async function GET(req: Request): Promise<NextResponse<Record<string, AiContext> | { error: string }>> {
  const ctx = createRequestContext(req, '/api/ai-context');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/ai-context', { method: 'GET' });

    try {
      const markdown = await fetchAiContext();
      const contextMap = parseAiContext(markdown);

      // Convert Map to plain object for JSON serialization
      const contextObject: Record<string, AiContext> = {};
      contextMap.forEach((value, key) => {
        contextObject[key] = value;
      });

      logger.request.completed('/api/ai-context', ctx.startTime);
      return NextResponse.json(contextObject, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      });
    } catch (error) {
      logger.request.failed('/api/ai-context', ctx.startTime, error);
      return NextResponse.json(
        { error: 'Failed to fetch AI context' },
        { status: 500 }
      );
    }
  });
}
