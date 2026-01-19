import Anthropic from '@anthropic-ai/sdk';
import { SHARED_CONTEXT } from '@/lib/generated/system-prompt';
import { getSharedContext } from '@/lib/system-prompt';
import { fetchFitAssessmentInstructions } from '@/lib/blob';

// Use Node.js runtime (not edge) to allow local file fallback in development
export const runtime = 'nodejs';

const client = new Anthropic();

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

    // Fetch shared context (profile data only, no chatbot instructions)
    console.log('[fit-assessment] Loading shared context (generated:', isGeneratedPromptAvailable, ')');
    const sharedContext = isGeneratedPromptAvailable
      ? SHARED_CONTEXT
      : await getSharedContext();
    console.log('[fit-assessment] Shared context loaded, length:', sharedContext.length);

    // Fetch fit assessment instructions
    console.log('[fit-assessment] Loading fit instructions');
    const fitInstructions = await getInstructions();
    console.log('[fit-assessment] Fit instructions loaded, length:', fitInstructions.length);

    // Combine: shared context + fit assessment instructions
    const systemPrompt = sharedContext + '\n\n---\n\n' + fitInstructions;
    console.log('[fit-assessment] System prompt ready, total length:', systemPrompt.length);

    console.log('[fit-assessment] Calling Anthropic API...');

    // Direct Anthropic SDK call - non-streaming for simpler debugging
    const message = await client.messages.create({
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

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    console.log('[fit-assessment] Response received, length:', text.length);

    return Response.json({ text });
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
