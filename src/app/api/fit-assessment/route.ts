import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { SHARED_CONTEXT } from '@/lib/generated/system-prompt';
import { getSharedContext } from '@/lib/system-prompt';
import { fetchFitAssessmentInstructions } from '@/lib/blob';

// Use Node.js runtime (not edge) to allow local file fallback in development
export const runtime = 'nodejs';

// Use generated prompt in production, fall back to runtime fetch in development
const isGeneratedPromptAvailable = SHARED_CONTEXT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_JD_LENGTH = 10000;
const MAX_BODY_SIZE = 50 * 1024; // 50KB max request body

// Cache the instructions (same pattern as system prompt)
let cachedInstructions: string | null = null;

async function getInstructions(): Promise<string> {
  if (cachedInstructions) return cachedInstructions;
  cachedInstructions = await fetchFitAssessmentInstructions();
  return cachedInstructions;
}

export async function POST(req: Request) {
  try {
    // Check content-length to prevent DoS via large payloads
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Request body too large.' }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { prompt: jobDescription } = await req.json();

    if (!jobDescription || typeof jobDescription !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Job description is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (jobDescription.length > MAX_JD_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'Job description too long.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Fetch shared context (profile data only, no chatbot instructions)
    const sharedContext = isGeneratedPromptAvailable
      ? SHARED_CONTEXT
      : await getSharedContext();

    // Fetch fit assessment instructions
    const fitInstructions = await getInstructions();

    // Combine: shared context + fit assessment instructions
    const systemPrompt = sharedContext + '\n\n---\n\n' + fitInstructions;

    const result = streamText({
      model: anthropic('claude-sonnet-4-20250514'),
      system: systemPrompt,
      prompt: `Generate an Executive Fit Report for this job description:\n\n${jobDescription}`,
    });

    return result.toTextStreamResponse();
  } catch (error) {
    console.error('Fit assessment error:', error);
    return new Response(
      JSON.stringify({ error: 'An error occurred.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
