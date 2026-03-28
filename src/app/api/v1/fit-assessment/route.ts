import Anthropic from '@anthropic-ai/sdk';
import { requireApiKey } from '@/lib/api-key-auth';
import { xmlEscape } from '@/lib/xml-escape';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { FIT_ASSESSMENT_PROMPT } from '@/lib/generated-system-prompt';
import {
  JobDescriptionInputError,
  resolveJobDescriptionInput,
} from '@/lib/job-description-input';
import { getClientIp } from '@/lib/rate-limit';
import { getFitAssessmentPrompt } from '@/lib/system-prompt';
import { logUsage } from '@/lib/usage-logger';

export const runtime = 'nodejs';

const client = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

const isGeneratedPromptAvailable = FIT_ASSESSMENT_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

const MAX_BODY_SIZE = 50 * 1024;

export async function POST(req: Request) {
  console.log('[api/v1/fit-assessment] Request received');
  const startTime = Date.now();

  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    let body: { input?: unknown; prompt?: unknown };
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Invalid JSON body.');
    }
    const input = body.input || body.prompt;

    if (!input || typeof input !== 'string') {
      return Errors.validationError('Job description or URL is required in "input" field.');
    }

    let jobDescriptionText = input;

    try {
      const resolvedInput = await resolveJobDescriptionInput(
        input,
        'Mozilla/5.0 (compatible; FitAssessmentBot/1.0)'
      );
      jobDescriptionText = resolvedInput.text;
    } catch (error) {
      if (error instanceof JobDescriptionInputError) {
        return Errors.badRequest(error.message);
      }
      throw error;
    }

    const systemPrompt = isGeneratedPromptAvailable
      ? FIT_ASSESSMENT_PROMPT
      : await getFitAssessmentPrompt();

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Generate an Executive Fit Report for this job description:\n\n<job_description>${xmlEscape(jobDescriptionText)}</job_description>`,
        },
      ],
    });

    const fitSessionId = `fit-assessment-api-${crypto.randomUUID()}`;

    const usage = message.usage;
    console.log(JSON.stringify({
      type: 'api_usage',
      timestamp: new Date().toISOString(),
      sessionId: fitSessionId,
      endpoint: 'fit-assessment-api',
      model: 'claude-sonnet-4-6',
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreation: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
    }));

    logUsage(fitSessionId, {
      endpoint: 'fit-assessment-api',
      model: 'claude-sonnet-4-6',
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      cacheCreation: usage.cache_creation_input_tokens ?? 0,
      cacheRead: usage.cache_read_input_tokens ?? 0,
      durationMs: Date.now() - startTime,
      cacheTtl: '1h',
    }, {
      apiKeyId: authResult.apiKey.id,
      apiKeyName: authResult.apiKey.name,
    }).catch((err) => console.warn('[api/v1/fit-assessment] Failed to log usage:', err));

    logApiAccess('api_fit_assessment', authResult.apiKey, {
      sessionId: fitSessionId,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      durationMs: Date.now() - startTime,
    }, ip).catch((err) => console.warn('[api/v1/fit-assessment] Failed to log audit:', err));

    const textContent = message.content.find((block) => block.type === 'text');
    const assessmentText = textContent?.type === 'text' ? textContent.text : '';

    return apiSuccess({
      assessment: assessmentText,
      model: message.model,
      usage: {
        inputTokens: usage.input_tokens,
        outputTokens: usage.output_tokens,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
      },
    });
  } catch (error) {
    console.error('[api/v1/fit-assessment] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
