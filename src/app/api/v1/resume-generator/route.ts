import Anthropic from '@anthropic-ai/sdk';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import {
  checkGenericRateLimit,
  getClientIp,
  RATE_LIMIT_CONFIGS,
} from '@/lib/rate-limit';
import {
  calculateReadinessScore,
  resumeDataToText,
  type ReadinessScore,
  type ResumeData as ScorerResumeData,
} from '@/lib/readiness-scorer';
import { resumeData } from '@/lib/resume-data';
import { sanitizeBreakdown, sanitizeScoreValue } from '@/lib/score-utils';
import { getResumeGeneratorPrompt } from '@/lib/resume-generator-prompt';
import { JobDescriptionInputError, resolveJobDescriptionInput } from '@/lib/job-description-input';

export const runtime = 'nodejs';
export const maxDuration = 120;

const client = new Anthropic({
  defaultHeaders: {
    'anthropic-beta': 'extended-cache-ttl-2025-04-11',
  },
});

const MAX_BODY_SIZE = 50 * 1024;
const AI_REQUEST_TIMEOUT_MS = 90_000;

function buildScoreContext(score: ReadinessScore): string {
  const { breakdown, details } = score;

  return `<pre_calculated_readiness_score>
## IMPORTANT: Pre-Calculated Readiness Score

The system has calculated a deterministic baseline readiness score for this job description.
Use this score as your "currentScore" in the response. DO NOT recalculate it.

### Current Score: ${score.total}/100

### Breakdown:
- Role Relevance: ${breakdown.roleRelevance}/30
- Clarity & Skimmability: ${breakdown.claritySkimmability}/30
- Business Impact: ${breakdown.businessImpact}/25
- Presentation Quality: ${breakdown.presentationQuality}/15

### Keyword Analysis:
- Match Rate: ${details.matchRate}%
- Keyword Density: ${details.keywordDensity}%
- Matched Keywords (${details.matchedKeywords.length}): ${details.matchedKeywords.slice(0, 15).join(', ')}${details.matchedKeywords.length > 15 ? '...' : ''}
- Missing Keywords (${details.missingKeywords.length}): ${details.missingKeywords.join(', ')}

### Your Task:
1. Use the currentScore values EXACTLY as provided above
2. Focus on clarity, quantified impact, and natural relevance
3. Propose changes that improve recruiter readability
4. Calculate optimizedScore based on your proposed changes
5. Each change should have an impactPoints estimate
</pre_calculated_readiness_score>`;
}

function extractTextContent(content: Array<{ type: string; text?: string }>): string {
  const textBlock = content.find((block) => block.type === 'text' && typeof block.text === 'string');
  return textBlock?.text ?? '';
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const trimmed = text.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(withoutFence) as Record<string, unknown>;
  } catch {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(withoutFence.slice(start, end + 1)) as Record<string, unknown>;
    }
    throw new Error('Invalid JSON response');
  }
}

function buildScoringInput(jobDescription: string) {
  const scorerResumeData: ScorerResumeData = {
    title: resumeData.title,
    yearsExperience: 15,
    teamSize: '13 engineers',
    skills: resumeData.skills.flatMap((s) => s.items),
    skillsByCategory: resumeData.skills,
    experiences: resumeData.experiences.map((e) => ({
      title: e.title,
      company: e.company,
      highlights: e.highlights,
    })),
    education: resumeData.education?.map((e) => ({
      degree: e.degree,
      institution: e.institution,
    })) ?? [],
    openToRoles: resumeData.openToRoles,
  };

  const resumeText = resumeDataToText({
    ...scorerResumeData,
    name: resumeData.name,
    summary: resumeData.brandingStatement,
  });

  const readinessScore = calculateReadinessScore({
    jobDescription,
    resumeText,
    resumeData: scorerResumeData,
  });

  return { readinessScore };
}

function normalizeChanges(changes: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(changes)) {
    return [];
  }

  return changes
    .filter((change) => change && typeof change === 'object')
    .map((change) => {
      const value = change as Record<string, unknown>;
      return {
        section: typeof value.section === 'string' ? value.section : 'unknown',
        original: typeof value.original === 'string' ? value.original : '',
        modified: typeof value.modified === 'string' ? value.modified : '',
        reason: typeof value.reason === 'string' ? value.reason : '',
        relevanceSignals: Array.isArray(value.relevanceSignals)
          ? value.relevanceSignals.filter((signal) => typeof signal === 'string')
          : [],
        impactPoints: sanitizeScoreValue(value.impactPoints, 0, 100),
      };
    });
}

function extractGaps(gaps: unknown): string[] {
  if (!Array.isArray(gaps)) {
    return [];
  }

  return gaps
    .map((gap) => {
      if (typeof gap === 'string') {
        return gap;
      }
      if (gap && typeof gap === 'object' && typeof (gap as Record<string, unknown>).requirement === 'string') {
        return (gap as Record<string, unknown>).requirement as string;
      }
      return '';
    })
    .filter((gap) => gap.length > 0);
}

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

    let body: { input?: unknown };
    try {
      body = await req.json();
    } catch {
      return Errors.badRequest('Invalid JSON body.');
    }

    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > MAX_BODY_SIZE) {
      return Errors.badRequest('Request body too large.');
    }

    if (!body.input || typeof body.input !== 'string') {
      return Errors.validationError('Job description or URL is required in "input" field.');
    }

    const resolvedInput = await resolveJobDescriptionInput(
      body.input,
      'Mozilla/5.0 (compatible; ResumeGeneratorBot/1.0)'
    );

    const systemPrompt = await getResumeGeneratorPrompt();
    const { readinessScore } = buildScoringInput(resolvedInput.text);

    const message = await (async () => {
      try {
        return await client.messages.create(
          {
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8192,
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
                content: `${buildScoreContext(readinessScore)}\n\nAnalyze this job description and provide resume readiness optimization recommendations. Return ONLY valid JSON, no markdown or code blocks.\n\n<job_description>${resolvedInput.text}</job_description>`,
              },
            ],
          },
          {
            signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
          }
        );
      } catch (error) {
        if (
          (error instanceof Error && error.name === 'TimeoutError') ||
          (error instanceof Error && /aborted|timeout/i.test(error.message))
        ) {
          return null;
        }
        throw error;
      }
    })();

    if (!message) {
      return Errors.internalError('Resume generation timed out');
    }

    const aiText = extractTextContent(message.content as Array<{ type: string; text?: string }>);
    const parsed = parseJsonResponse(aiText);

    const analysis = parsed.analysis && typeof parsed.analysis === 'object'
      ? parsed.analysis as Record<string, unknown>
      : {};

    const optimizedScoreInput = parsed.optimizedScore && typeof parsed.optimizedScore === 'object'
      ? parsed.optimizedScore as Record<string, unknown>
      : {};

    const optimizedBreakdownInput = optimizedScoreInput.breakdown && typeof optimizedScoreInput.breakdown === 'object'
      ? optimizedScoreInput.breakdown as Record<string, unknown>
      : {};

    const optimizedScore = {
      total: sanitizeScoreValue(optimizedScoreInput.total, readinessScore.total, 100),
      breakdown: sanitizeBreakdown({
        roleRelevance: sanitizeScoreValue(optimizedBreakdownInput.roleRelevance, 0, 30),
        claritySkimmability: sanitizeScoreValue(optimizedBreakdownInput.claritySkimmability, 0, 30),
        businessImpact: sanitizeScoreValue(optimizedBreakdownInput.businessImpact, 0, 25),
        presentationQuality: sanitizeScoreValue(optimizedBreakdownInput.presentationQuality, 0, 15),
      }),
    };

    const maxFromResponse = sanitizeScoreValue(
      parsed.maxPossibleScore ?? (parsed.scoreCeiling as Record<string, unknown> | undefined)?.maximum,
      0,
      100
    );

    const maxPossibleScore = Math.max(
      readinessScore.total,
      optimizedScore.total,
      maxFromResponse
    );

    const responseData = {
      generationId: crypto.randomUUID(),
      companyName: typeof analysis.companyName === 'string'
        ? analysis.companyName
        : (typeof parsed.companyName === 'string' ? parsed.companyName : 'Unknown'),
      roleTitle: typeof analysis.roleTitle === 'string'
        ? analysis.roleTitle
        : (typeof parsed.roleTitle === 'string' ? parsed.roleTitle : 'Unknown'),
      currentScore: {
        total: readinessScore.total,
        breakdown: sanitizeBreakdown(readinessScore.breakdown),
        matchedKeywords: readinessScore.details.matchedKeywords,
        missingKeywords: readinessScore.details.missingKeywords,
        matchRate: readinessScore.details.matchRate,
        keywordDensity: readinessScore.details.keywordDensity,
      },
      optimizedScore,
      maxPossibleScore,
      proposedChanges: normalizeChanges(parsed.proposedChanges),
      gapsIdentified: extractGaps(parsed.gaps),
      inputType: resolvedInput.inputType,
      extractedUrl: resolvedInput.extractedUrl,
    };

    try {
      await logApiAccess('api_resume_generation', authResult.apiKey, {
        inputType: resolvedInput.inputType,
        extractedUrl: resolvedInput.extractedUrl,
        currentScore: responseData.currentScore.total,
        optimizedScore: responseData.optimizedScore.total,
        proposedChanges: responseData.proposedChanges.length,
      }, ip);
    } catch (error) {
      console.warn('[api/v1/resume-generator] Failed to log audit:', error);
    }

    return apiSuccess(responseData);
  } catch (error) {
    if (error instanceof JobDescriptionInputError) {
      return Errors.badRequest(error.message);
    }

    console.error('[api/v1/resume-generator] Error:', error);
    return Errors.internalError('AI service error.');
  }
}
