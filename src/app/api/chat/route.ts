import Anthropic from '@anthropic-ai/sdk';
import { CHATBOT_SYSTEM_PROMPT } from '@/lib/generated/system-prompt';
import { getFullSystemPrompt } from '@/lib/system-prompt';

// Use Node.js runtime for reliable Anthropic SDK streaming
export const runtime = 'nodejs';

const client = new Anthropic();

// Use generated prompt in production, fall back to runtime fetch in development
const isGeneratedPromptAvailable = CHATBOT_SYSTEM_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 50;
// Maximum request body size: 50 messages * 2000 chars + overhead ≈ 150KB
const MAX_BODY_SIZE = 150 * 1024;

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function validateMessages(messages: unknown): messages is ChatMessage[] {
  if (!Array.isArray(messages)) return false;
  if (messages.length > MAX_MESSAGES) return false;

  return messages.every(
    (msg) =>
      typeof msg === 'object' &&
      msg !== null &&
      (msg.role === 'user' || msg.role === 'assistant') &&
      typeof msg.content === 'string' &&
      msg.content.length <= MAX_MESSAGE_LENGTH
  );
}

export async function POST(req: Request) {
  console.log('[chat] Request received');
  try {
    // Check content-length to prevent DoS via large payloads
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Response.json({ error: 'Request body too large.' }, { status: 413 });
    }

    const { messages } = await req.json();

    if (!validateMessages(messages)) {
      return Response.json(
        { error: 'Invalid messages format or content too long.' },
        { status: 400 }
      );
    }

    // Use build-time generated prompt (production) or fetch at runtime (development)
    const systemPrompt = isGeneratedPromptAvailable
      ? CHATBOT_SYSTEM_PROMPT
      : await getFullSystemPrompt();

    console.log('[chat] Starting stream, messages:', messages.length);

    // Use Anthropic SDK streaming
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Convert to ReadableStream for the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          controller.close();
          console.log('[chat] Stream completed');
        } catch (error) {
          console.error('[chat] Stream error:', error);
          controller.error(error);
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
      },
    });
  } catch (error) {
    console.error('[chat] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      { error: `Chat service error: ${errorMessage}` },
      { status: 500 }
    );
  }
}
