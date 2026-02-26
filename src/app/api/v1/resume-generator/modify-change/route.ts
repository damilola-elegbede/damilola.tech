import Anthropic from '@anthropic-ai/sdk';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import type { ModifyChangeRequest, ProposedChange } from '@/lib/types/resume-generation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const client = new Anthropic();

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidProposedChange(value: unknown): value is ProposedChange {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.section) &&
    isNonEmptyString(value.original) &&
    isNonEmptyString(value.modified) &&
    isNonEmptyString(value.reason) &&
    Array.isArray(value.keywordsAdded) &&
    value.keywordsAdded.every((keyword) => typeof keyword === 'string') &&
    typeof value.impactPoints === 'number'
  );
}

function parseModifyChangeRequest(body: unknown): ModifyChangeRequest | null {
  if (!isObjectRecord(body)) {
    return null;
  }

  if (
    !isValidProposedChange(body.originalChange) ||
    !isNonEmptyString(body.modifyPrompt) ||
    !isNonEmptyString(body.jobDescription)
  ) {
    return null;
  }

  return {
    originalChange: body.originalChange,
    modifyPrompt: body.modifyPrompt,
    jobDescription: body.jobDescription,
  };
}

export async function POST(req: Request) {
  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);
  let body: unknown;

  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body');
  }

  const parsedBody = parseModifyChangeRequest(body);
  if (!parsedBody) {
    return Errors.badRequest(
      'Invalid request body. Expected originalChange, modifyPrompt, and jobDescription with valid types.'
    );
  }

  try {
    const { originalChange, modifyPrompt, jobDescription } = parsedBody;

    // Wrap user input in XML tags for prompt injection mitigation
    const prompt = `You are revising a single resume change for ATS optimization.

<original_change>
Section: ${xmlEscape(originalChange.section)}
Original text: ${xmlEscape(originalChange.original)}
Proposed modification: ${xmlEscape(originalChange.modified)}
Reason: ${xmlEscape(originalChange.reason)}
</original_change>

<modify_request>${xmlEscape(modifyPrompt)}</modify_request>

Job Description (for context, truncated to 4000 chars to fit context window):
<job_description>${xmlEscape(jobDescription.slice(0, 4000))}</job_description>

Return ONLY a JSON object with the revised change (no markdown code blocks):
{
  "section": "${originalChange.section}",
  "original": "${originalChange.original}",
  "modified": "YOUR REVISED TEXT HERE",
  "reason": "Updated reason explaining the change",
  "keywordsAdded": ["keyword1", "keyword2"],
  "impactPoints": ${originalChange.impactPoints}
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from response
    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      return Errors.internalError('No text response from AI');
    }

    let jsonText = textBlock.text.trim();

    // Clean markdown code blocks if present
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const revisedChange: ProposedChange = JSON.parse(jsonText);

    // Validate the response has all required fields
    if (
      !revisedChange.section ||
      !revisedChange.original ||
      !revisedChange.modified ||
      !revisedChange.reason ||
      !Array.isArray(revisedChange.keywordsAdded) ||
      typeof revisedChange.impactPoints !== 'number'
    ) {
      return Errors.internalError('Invalid response structure from AI');
    }

    // Prevent model drift from mutating immutable fields for the selected change.
    if (
      revisedChange.section !== originalChange.section ||
      revisedChange.original !== originalChange.original
    ) {
      return Errors.internalError('AI response modified immutable change fields');
    }

    logApiAccess('api_modify_change', authResult.apiKey, {
      section: originalChange.section,
      impactPoints: revisedChange.impactPoints,
      keywordCount: revisedChange.keywordsAdded.length,
    }, ip).catch((err) => console.warn('[api/v1/resume-generator/modify-change] Failed to log audit:', err));

    return apiSuccess({ revisedChange });
  } catch (error) {
    console.error('[api/v1/resume-generator/modify-change] Error:', error);
    if (error instanceof SyntaxError) {
      return Errors.internalError('Failed to parse AI response as JSON');
    }
    return Errors.internalError('AI service error');
  }
}
