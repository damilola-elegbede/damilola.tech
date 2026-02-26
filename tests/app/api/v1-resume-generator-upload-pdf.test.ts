/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPut(...args),
}));

const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

const mockLogApiAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/resume-generator/upload-pdf API route', () => {
  const originalEnv = { ...process.env };
  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    mockRequireApiKey.mockResolvedValue(mockValidApiKey);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function createPdfFile(size: number = 1024, valid = true): File {
    const buffer = new ArrayBuffer(size);
    const bytes = new Uint8Array(buffer);
    if (valid) {
      bytes[0] = 0x25;
      bytes[1] = 0x50;
      bytes[2] = 0x44;
      bytes[3] = 0x46;
    }

    const file = new File([buffer], 'resume.pdf', { type: 'application/pdf' });
    file.arrayBuffer = async () => buffer;
    Object.defineProperty(file, 'size', { value: size, writable: false });
    return file;
  }

  function createRequest(overrides: {
    pdf?: File | null;
    companyName?: string | null;
    roleTitle?: string | null;
  } = {}): Request {
    const formData = new Map<string, File | string>();

    if (overrides.pdf !== null) {
      formData.set('pdf', overrides.pdf ?? createPdfFile());
    }
    if (overrides.companyName !== null) {
      formData.set('companyName', overrides.companyName ?? 'Acme');
    }
    if (overrides.roleTitle !== null) {
      formData.set('roleTitle', overrides.roleTitle ?? 'Staff Engineer');
    }

    const req = new Request('http://localhost/api/v1/resume-generator/upload-pdf', {
      method: 'POST',
    });

    req.formData = vi.fn().mockResolvedValue({
      get: (key: string) => formData.get(key) ?? null,
    });

    return req;
  }

  it('returns auth response when API key is missing/invalid', async () => {
    mockRequireApiKey.mockResolvedValue(
      Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
        { status: 401 }
      )
    );

    const { POST } = await import('@/app/api/v1/resume-generator/upload-pdf/route');
    const response = await POST(createRequest());
    expect(response.status).toBe(401);
  });

  it('validates missing file and metadata', async () => {
    const { POST } = await import('@/app/api/v1/resume-generator/upload-pdf/route');

    const noFileResponse = await POST(createRequest({ pdf: null }));
    expect(noFileResponse.status).toBe(400);

    const noCompanyResponse = await POST(createRequest({ companyName: null }));
    expect(noCompanyResponse.status).toBe(400);
  });

  it('uploads valid PDF and returns success envelope', async () => {
    process.env.VERCEL = '1';
    process.env.VERCEL_ENV = 'production';

    mockPut.mockResolvedValue({
      url: 'https://blob.vercel-storage.com/test.pdf',
      pathname: 'damilola.tech/resume/generated/production/acme-staff-engineer-2026-02-26-1.pdf',
    });

    const { POST } = await import('@/app/api/v1/resume-generator/upload-pdf/route');
    const response = await POST(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.url).toBe('https://blob.vercel-storage.com/test.pdf');
    expect(data.data.filename).toMatch(/^acme-staff-engineer-\d{4}-\d{2}-\d{2}-\d+\.pdf$/);
    expect(mockLogApiAccess).toHaveBeenCalledWith(
      'api_resume_pdf_uploaded',
      mockValidApiKey.apiKey,
      expect.objectContaining({
        companyName: 'Acme',
        roleTitle: 'Staff Engineer',
      }),
      '127.0.0.1'
    );
  });

  it('handles validation and storage errors', async () => {
    const { POST } = await import('@/app/api/v1/resume-generator/upload-pdf/route');

    const invalidPdfResponse = await POST(createRequest({ pdf: createPdfFile(1024, false) }));
    expect(invalidPdfResponse.status).toBe(400);

    mockPut.mockRejectedValue(new Error('blob down'));
    const errorResponse = await POST(createRequest());
    const errorData = await errorResponse.json();
    expect(errorResponse.status).toBe(500);
    expect(errorData.error.code).toBe('INTERNAL_ERROR');
  });

  it('returns PAYLOAD_TOO_LARGE for oversized PDF files', async () => {
    const { POST } = await import('@/app/api/v1/resume-generator/upload-pdf/route');

    const oversizedResponse = await POST(createRequest({ pdf: createPdfFile(10 * 1024 * 1024 + 1) }));
    const data = await oversizedResponse.json();

    expect(oversizedResponse.status).toBe(413);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
