import { put } from '@vercel/blob';
import { requireApiKey } from '@/lib/api-key-auth';
import { logApiAccess } from '@/lib/api-audit';
import { apiSuccess, apiError, Errors } from '@/lib/api-response';
import { getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;

function getEnvironment(): string {
  if (process.env.VERCEL) {
    return process.env.VERCEL_ENV === 'production' ? 'production' : 'preview';
  }
  return process.env.NODE_ENV === 'production' ? 'production' : 'preview';
}

export async function POST(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File | null;
    const companyName = formData.get('companyName') as string | null;
    const roleTitle = formData.get('roleTitle') as string | null;

    if (!file) {
      return Errors.badRequest('No PDF file provided');
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return apiError(
        'BAD_REQUEST',
        `File too large. Maximum size is ${MAX_PDF_SIZE_BYTES / (1024 * 1024)}MB`,
        413
      );
    }

    if (!companyName || !roleTitle) {
      return Errors.badRequest('Company name and role title are required');
    }

    const sanitize = (str: string) =>
      str
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .toLowerCase()
        .slice(0, 30);

    const date = new Date().toISOString().split('T')[0];
    const timestamp = Date.now();
    const safeCompany = sanitize(companyName) || 'company';
    const safeRole = sanitize(roleTitle) || 'role';
    const filename = `${safeCompany}-${safeRole}-${date}-${timestamp}.pdf`;
    const environment = getEnvironment();

    const blobPath = `damilola.tech/resume/generated/${environment}/${filename}`;

    const buffer = await file.arrayBuffer();

    const uint8 = new Uint8Array(buffer);
    const pdfMagic = String.fromCharCode(...uint8.slice(0, 4));
    if (pdfMagic !== '%PDF') {
      return Errors.badRequest('Invalid PDF file');
    }

    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: 'application/pdf',
    });

    logApiAccess('api_resume_pdf_uploaded', authResult.apiKey, {
      companyName,
      roleTitle,
      filename,
      fileSize: file.size,
      blobPath,
    }, ip).catch((err) => console.warn('[api/v1/resume-generator/upload-pdf] Failed to log audit:', err));

    return apiSuccess({
      url: blob.url,
      filename,
    });
  } catch (error) {
    console.error('[api/v1/resume-generator/upload-pdf] Error:', error);
    return Errors.internalError('Failed to upload PDF');
  }
}
