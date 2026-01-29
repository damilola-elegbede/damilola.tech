import Anthropic from '@anthropic-ai/sdk';
import { CHATBOT_SYSTEM_PROMPT } from '@/lib/generated/system-prompt';
import { getFullSystemPrompt } from '@/lib/system-prompt';
import { saveConversationToBlob } from '@/lib/chat-storage-server';
import { compactConversation } from '@/lib/chat-compaction';
import {
  checkGenericRateLimit,
  createRateLimitResponse,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { logUsage } from '@/lib/usage-logger';
import { logger, logColdStartIfNeeded, checkTimeoutWarning } from '@/lib/logger';
import {
  withRequestContext,
  createRequestContext,
  updateRequestContext,
  captureContext,
} from '@/lib/request-context';

// Use Node.js runtime for reliable Anthropic SDK streaming
export const runtime = 'nodejs';

const client = new Anthropic();

// Use generated prompt in production, fall back to runtime fetch in development
const isGeneratedPromptAvailable = CHATBOT_SYSTEM_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 200;
// Maximum request body size: 200 messages * 2000 chars + overhead ≈ 500KB
const MAX_BODY_SIZE = 500 * 1024;
const COMPACTION_THRESHOLD = 180; // 90% of MAX_MESSAGES

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

/**
 * Escape XML entities to prevent injection when wrapping user content in XML tags.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function POST(req: Request) {
  const ctx = createRequestContext(req, '/api/chat');

  return withRequestContext(ctx, async () => {
    logColdStartIfNeeded();
    logger.request.received('/api/chat', { method: 'POST' });

    try {
      // Check content-length to prevent DoS via large payloads
      const contentLength = req.headers.get('content-length');
      if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
        logger.security.largePayloadRejected(
          ctx.ip || 'unknown',
          parseInt(contentLength, 10),
          MAX_BODY_SIZE
        );
        return Response.json({ error: 'Request body too large.' }, { status: 413 });
      }

      let messages, sessionId, sessionStartedAt;
      try {
        const body = await req.json();
        messages = body.messages;
        sessionId = body.sessionId;
        sessionStartedAt = body.sessionStartedAt;
      } catch {
        logger.debug('request.invalid_json', { endpoint: '/api/chat' });
        return Response.json({ error: 'Invalid JSON in request body.' }, { status: 400 });
      }

      // Validate session identifiers to prevent path injection
      const isValidSessionId =
        typeof sessionId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId);
      const isValidSessionStartedAt =
        typeof sessionStartedAt === 'string' && !Number.isNaN(Date.parse(sessionStartedAt));

      // Update context with session ID for log correlation
      if (isValidSessionId) {
        updateRequestContext({ sessionId: `sess_${sessionId.slice(0, 8)}` });
      }

      // Rate limit check: always use IP to prevent bypass via client-controlled sessionId
      const ip = getClientIp(req);
      const rateLimitResult = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.chat, ip);
      if (rateLimitResult.limited) {
        logger.security.rateLimitTriggered(ip, '/api/chat', {
          retryAfter: rateLimitResult.retryAfter,
        });
        return createRateLimitResponse(rateLimitResult);
      }

      if (!validateMessages(messages)) {
        logger.debug('request.validation_failed', {
          endpoint: '/api/chat',
          reason: 'Invalid messages format or content too long',
        });
        return Response.json(
          { error: 'Invalid messages format or content too long.' },
          { status: 400 }
        );
      }

      // Use build-time generated prompt (production) or fetch at runtime (development)
      const basePrompt = isGeneratedPromptAvailable
        ? CHATBOT_SYSTEM_PROMPT
        : await getFullSystemPrompt();

      // Reinforce brevity at the system level
      const brevityPrefix = `CRITICAL: Keep responses SHORT. Default: 2-4 sentences. Simple factual questions: 1-2 sentences. Only use STAR format for behavioral questions. Never volunteer extra context unless asked.\n\n`;
      const systemPrompt = brevityPrefix + basePrompt;

      // Auto-compact conversation if approaching limits
      const {
        messages: processedMessages,
        wasCompacted,
        originalCount,
      } = await compactConversation(messages, client, COMPACTION_THRESHOLD);

      if (wasCompacted) {
        logger.info('chat.compacted', {
          originalCount,
          newCount: processedMessages.length,
        });
      }

      logger.stream.started('/api/chat', { messageCount: processedMessages.length });

      // Use Anthropic SDK streaming
      // Wrap user messages in XML tags for prompt injection mitigation
      // Enable prompt caching for the system prompt (90% cost reduction on cache hits)
      const stream = client.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512, // Reduced to encourage brevity
        system: [
          {
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' },
          },
        ],
        messages: processedMessages.map((m) => ({
          role: m.role,
          content:
            m.role === 'user' ? `<user_message>${escapeXml(m.content)}</user_message>` : m.content,
        })),
      });

      // Capture context for fire-and-forget operations
      const capturedCtx = captureContext();
      let firstByteLogged = false;

      // Convert to ReadableStream for the response
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          let fullResponse = '';
          try {
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                // Log time to first byte
                if (!firstByteLogged) {
                  logger.stream.firstByte(ctx.startTime);
                  firstByteLogged = true;
                }
                fullResponse += event.delta.text;
                controller.enqueue(encoder.encode(event.delta.text));
              }

              // Check for approaching timeout
              checkTimeoutWarning(ctx.startTime, '/api/chat');
            }
            controller.close();

            const streamDuration = Date.now() - ctx.startTime;

            // Save to Blob after stream completes (fire-and-forget)
            if (isValidSessionId && isValidSessionStartedAt) {
              const fullConversation = [
                ...messages,
                { role: 'assistant' as const, content: fullResponse },
              ];
              saveConversationToBlob(sessionId, sessionStartedAt, fullConversation).catch((err) =>
                logger.warn('blob.save_failed', {
                  requestId: capturedCtx?.requestId,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
            }

            // Log usage metrics for cost tracking
            try {
              const finalMessage = await stream.finalMessage();
              const usage = finalMessage.usage;

              const cacheHitRate =
                usage.input_tokens > 0
                  ? (usage.cache_read_input_tokens ?? 0) / usage.input_tokens
                  : 0;

              logger.stream.completed(ctx.startTime, {
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                cacheCreation: usage.cache_creation_input_tokens ?? 0,
                cacheRead: usage.cache_read_input_tokens ?? 0,
                cacheHitRate: Math.round(cacheHitRate * 100) / 100,
              });

              // Log to Vercel Blob for usage dashboard (fire-and-forget)
              logUsage(isValidSessionId ? sessionId : 'anonymous', {
                endpoint: 'chat',
                model: 'claude-sonnet-4-20250514',
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                cacheCreation: usage.cache_creation_input_tokens ?? 0,
                cacheRead: usage.cache_read_input_tokens ?? 0,
                durationMs: streamDuration,
              }).catch((err) =>
                logger.error('usage.log_failed', {
                  requestId: capturedCtx?.requestId,
                  error: err instanceof Error ? err.message : String(err),
                })
              );
            } catch (usageError) {
              logger.warn('usage.retrieval_failed', {
                error: usageError instanceof Error ? usageError.message : String(usageError),
              });
            }
          } catch (error) {
            // Handle Anthropic API errors with appropriate levels
            if (error instanceof Anthropic.APIError) {
              if (error.status === 429) {
                logger.anthropic.rateLimited(error.headers?.['retry-after'] as string | undefined);
              } else if (error.status >= 500) {
                logger.anthropic.serverError(error.status, error.message);
              } else {
                logger.anthropic.apiError(error.status, error.message);
              }
            } else {
              logger.stream.error(ctx.startTime, error);
            }
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
      logger.request.failed('/api/chat', ctx.startTime, error);
      return Response.json({ error: 'Chat service error.' }, { status: 500 });
    }
  });
}
