import { fetchAllContent } from '@/lib/blob';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, Errors } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const content = await fetchAllContent();

    if (!content.resume) {
      return Errors.internalError('Resume data not available.');
    }

    const parsed = JSON.parse(content.resume) as unknown;

    logApiAccess('api_resume_data_accessed', authResult.apiKey, {
      hasResume: true,
    }, ip).catch((error) => {
      console.warn('[api/v1/resume-data] Failed to log audit:', error);
    });

    return apiSuccess(parsed);
  } catch (error) {
    console.error('[api/v1/resume-data] Error:', error);
    return Errors.internalError('Failed to load resume data.');
  }
}
