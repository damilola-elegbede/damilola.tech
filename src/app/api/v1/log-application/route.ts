import { randomUUID } from 'crypto';
import { requireApiKey } from '@/lib/api-key-auth';
import { Errors } from '@/lib/api-response';
import { saveApplication } from '@/lib/applications-store';
import { APPLICATION_STATUSES } from '@/lib/types/application';
import type { Application, ApplicationStatus } from '@/lib/types/application';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest('Invalid JSON body.');
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return Errors.validationError('Request body must be a JSON object.');
  }

  const b = body as Record<string, unknown>;

  // Required fields
  const company = typeof b['company'] === 'string' ? b['company'].trim() : '';
  const title = typeof b['title'] === 'string' ? b['title'].trim() : '';

  if (!company) {
    return Errors.validationError('missing required field: company');
  }
  if (!title) {
    return Errors.validationError('missing required field: title');
  }

  // Optional fields
  const url = typeof b['url'] === 'string' ? b['url'].trim() : null;
  const role_id = typeof b['role_id'] === 'string' ? b['role_id'].trim() : null;
  const notes = typeof b['notes'] === 'string' ? b['notes'].trim() : null;
  const cover_letter_draft = typeof b['cover_letter_draft'] === 'string' ? b['cover_letter_draft'] : null;

  // status — default "applied", validate against enum
  const rawStatus = b['status'];
  const status: ApplicationStatus =
    rawStatus === undefined || rawStatus === null ? 'applied' : (rawStatus as ApplicationStatus);

  if (!APPLICATION_STATUSES.includes(status)) {
    return Response.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `invalid status value: '${String(rawStatus)}'`,
        },
      },
      { status: 422 }
    );
  }

  // score — optional 0–100
  let score: number | null = null;
  if (b['score'] !== undefined && b['score'] !== null) {
    if (typeof b['score'] !== 'number' || !Number.isFinite(b['score'])) {
      return Errors.validationError('score must be a number between 0 and 100.');
    }
    if (b['score'] < 0 || b['score'] > 100) {
      return Errors.validationError('score must be between 0 and 100.');
    }
    score = b['score'];
  }

  // applied_at — optional ISO-Z string, default now
  let applied_at: string;
  if (b['applied_at'] !== undefined && b['applied_at'] !== null) {
    if (typeof b['applied_at'] !== 'string') {
      return Errors.validationError('applied_at must be an ISO date string.');
    }
    const parsed = Date.parse(b['applied_at']);
    if (isNaN(parsed)) {
      return Errors.validationError('applied_at must be a valid ISO date string.');
    }
    applied_at = b['applied_at'];
  } else {
    applied_at = new Date().toISOString();
  }

  const now = new Date().toISOString();
  const id = randomUUID();

  const application: Application = {
    id,
    company,
    title,
    url,
    role_id,
    applied_at,
    status,
    score,
    notes,
    cover_letter_draft,
    created_at: now,
    updated_at: now,
  };

  try {
    await saveApplication(application);
  } catch (err) {
    console.error('[api/v1/log-application] Failed to save application:', err);
    return Errors.internalError('Failed to save application.');
  }

  return Response.json(
    {
      success: true,
      data: {
        id,
        company,
        title,
        applied_at,
        status,
        score,
        url,
        cover_letter_draft,
      },
    },
    { status: 201 }
  );
}
