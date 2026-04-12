import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { xmlEscape } from '@/lib/xml-escape';
import {
  checkGenericRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import { sanitizeScoreValue } from '@/lib/score-utils';
import { JobDescriptionInputError, resolveJobDescriptionInput } from '@/lib/job-description-input';
import {
  scoringClient,
  buildScorePayload,
  buildScoringInput,
  buildGapAnalysisPrompt,
  extractTextContent,
  parseJsonResponse,
} from '@/lib/score-core';

export const runtime = 'nodejs';

const MAX_BODY_SIZE = 50 * 1024;

export async function POST(req: Request) {
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

    const rateLimit = await checkGenericRateLimit(RATE_LIMIT_CONFIGS.resumeGenerator, ip);
    if (rateLimit.limited) {
      return Errors.rateLimited(rateLimit.retryAfter || 60);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Invalid JSON body.');
    }

    if (!body || typeof body !== 'object') {
      return Errors.validationError('Request body must be a JSON object.');
    }

    const { url, title, company } = body as Record<string, unknown>;

    if (!url || typeof url !== 'string') {
      return Errors.validationError('"url" is required and must be a string.');
    }
    if (!title || typeof title !== 'string') {
      return Errors.validationError('"title" is required and must be a string.');
    }
    if (!company || typeof company !== 'string') {
      return Errors.validationError('"company" is required and must be a string.');
    }

    const resolvedInput = await resolveJobDescriptionInput(
      url,
      'Mozilla/5.0 (compatible; ResumeScoreBot/1.0)'
    );

    const { readinessScore } = buildScoringInput(resolvedInput.text);
    const currentScore = buildScorePayload(readinessScore);

    const message = await scoringClient.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1200,
      temperature: 0,
      system: [
        {
          type: 'text',
          text: 'You are a resume readiness analyst. Be concise and accurate.',
          cache_control: { type: 'ephemeral', ttl: '1h' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `${buildGapAnalysisPrompt(currentScore)}\n\n<job_description>${xmlEscape(resolvedInput.text)}</job_description>`,
        },
      ],
    });

    const responseText = extractTextContent(message.content as Array<{ type: string; text?: string }>);
    const parsed = parseJsonResponse(responseText);

    const gapAnalysis = typeof parsed.gapAnalysis === 'string' ? parsed.gapAnalysis : '';
    const parsedMaxScore = sanitizeScoreValue(parsed.maxPossibleScore, 0, 100);
    const maxPossibleScore = Math.max(currentScore.total, parsedMaxScore);
    const gap = maxPossibleScore - currentScore.total;

    const recommendation = gap > 15
      ? 'full_generation_recommended'
      : gap >= 5
        ? 'marginal_improvement'
        : 'strong_fit';

    logApiAccess('api_score_job', authResult.apiKey, {
      company,
      title,
      url,
      inputType: resolvedInput.inputType,
      extractedUrl: resolvedInput.extractedUrl,
      currentScore: currentScore.total,
      maxPossibleScore,
      recommendation,
    }, ip).catch((error) => {
      console.warn('[api/v1/score-job] Failed to log audit:', error);
    });

    return apiSuccess({
      company,
      title,
      url,
      currentScore,
      maxPossibleScore,
      gapAnalysis,
      recommendation,
    });
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message);
    }

    console.error('[api/v1/score-job] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
