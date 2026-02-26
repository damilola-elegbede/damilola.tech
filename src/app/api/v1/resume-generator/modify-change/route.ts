import Anthropic from '@anthropic-ai/sdk';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';
import type { ModifyChangeRequest, ProposedChange } from '@/lib/types/resume-generation';

export const runtime = 'nodejs';
export const maxDuration = 60;

const client = new Anthropic();

export async function POST(req: Request) {
  // Authenticate with API key
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const { originalChange, modifyPrompt, jobDescription }: ModifyChangeRequest = await req.json();

    if (!originalChange || !modifyPrompt || !jobDescription) {
      return Errors.badRequest('Missing required fields: originalChange, modifyPrompt, jobDescription');
    }

    // Wrap user input in XML tags for prompt injection mitigation
    const prompt = `You are revising a single resume change for ATS optimization.

<original_change>
Section: ${originalChange.section}
Original text: ${originalChange.original}
Proposed modification: ${originalChange.modified}
Reason: ${originalChange.reason}
</original_change>

<modify_request>${modifyPrompt}</modify_request>

Job Description (for context, truncated to 4000 chars to fit context window):
<job_description>${jobDescription.slice(0, 4000)}</job_description>

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
