import Anthropic from '@anthropic-ai/sdk';
import { FIT_ASSESSMENT_PROMPT } from '@/lib/generated/system-prompt';
import { getFitAssessmentPrompt } from '@/lib/system-prompt';

// Use Node.js runtime (not edge) to allow local file fallback in development
export const runtime = 'nodejs';

const client = new Anthropic();

// Use generated prompt in production, fall back to runtime fetch in development
const isGeneratedPromptAvailable = FIT_ASSESSMENT_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_JD_LENGTH = 10000;
const MAX_BODY_SIZE = 50 * 1024; // 50KB max request body

export async function POST(req: Request) {
  console.log('[fit-assessment] Request received');
  try {
    // Check content-length to prevent DoS via large payloads
    const contentLength = req.headers.get('content-length');
    console.log('[fit-assessment] Content-Length:', contentLength);
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      console.log('[fit-assessment] Request body too large, rejecting');
      return Response.json({ error: 'Request body too large.' }, { status: 413 });
    }

    const { prompt: jobDescription } = await req.json();
    console.log('[fit-assessment] Job description length:', jobDescription?.length ?? 0);

    if (!jobDescription || typeof jobDescription !== 'string') {
      console.log('[fit-assessment] Invalid job description, rejecting');
      return Response.json({ error: 'Job description is required.' }, { status: 400 });
    }

    if (jobDescription.length > MAX_JD_LENGTH) {
      console.log('[fit-assessment] Job description too long, rejecting');
      return Response.json({ error: 'Job description too long.' }, { status: 400 });
    }

    // Use generated prompt in production, fall back to runtime fetch in development
    console.log('[fit-assessment] Loading system prompt (generated:', isGeneratedPromptAvailable, ')');
    const systemPrompt = isGeneratedPromptAvailable
      ? FIT_ASSESSMENT_PROMPT
      : await getFitAssessmentPrompt();
    console.log('[fit-assessment] System prompt loaded, length:', systemPrompt.length);

    console.log('[fit-assessment] Calling Anthropic API (streaming)...');

    // Streaming API call for progressive text display
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Generate an Executive Fit Report for this job description:\n\n${jobDescription}`,
        },
      ],
    });

    // Return streaming response
    return new Response(
      new ReadableStream({
        async start(controller) {
          try {
            for await (const event of stream) {
              if (
                event.type === 'content_block_delta' &&
                event.delta.type === 'text_delta'
              ) {
                controller.enqueue(new TextEncoder().encode(event.delta.text));
              }
            }
            controller.close();
            console.log('[fit-assessment] Stream completed');
          } catch (streamError) {
            console.error('[fit-assessment] Stream error:', streamError);
            controller.error(streamError);
          }
        },
      }),
      {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Transfer-Encoding': 'chunked',
        },
      }
    );
  } catch (error) {
    console.error('[fit-assessment] Error:', error);
    console.error('[fit-assessment] Stack:', error instanceof Error ? error.stack : 'No stack');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      { error: `AI service error: ${errorMessage}` },
      { status: 503 }
    );
  }
}
