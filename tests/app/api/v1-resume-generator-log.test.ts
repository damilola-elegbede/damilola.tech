/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockPut = vi.fn();
const mockList = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPut(...args),
  list: (...args: unknown[]) => mockList(...args),
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

describe('v1/resume-generator/log API route', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  const validLogData = {
    generationId: 'gen-123',
    jobId: 'job-456',
    jobIdentifier: { type: 'url', hash: 'abc123' },
    companyName: 'Acme Corp',
    roleTitle: 'Senior Software Engineer',
    jobDescriptionFull: 'We are looking for a senior software engineer...',
    estimatedCompatibility: {
      before: 65,
      after: 85,
      breakdown: {
        keywordRelevance: 32,
        skillsQuality: 20,
        experienceAlignment: 18,
        contentQuality: 8,
      },
    },
    changesAccepted: [],
    changesRejected: [],
    gapsIdentified: [],
    pdfUrl: 'https://blob.vercel-storage.com/resume.pdf',
    optimizedResumeJson: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
    global.fetch = vi.fn();
    mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    mockList.mockResolvedValue({ blobs: [] });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('returns auth response when API key is missing/invalid', async () => {
    mockRequireApiKey.mockResolvedValue(
      Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
        { status: 401 }
      )
    );

    const { POST } = await import('@/app/api/v1/resume-generator/log/route');
    const request = new Request('http://localhost/api/v1/resume-generator/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLogData),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('validates missing required fields', async () => {
    const { POST } = await import('@/app/api/v1/resume-generator/log/route');
    const request = new Request('http://localhost/api/v1/resume-generator/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ generationId: 'x' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('creates a new log record successfully', async () => {
    process.env.VERCEL = '1';
    process.env.VERCEL_ENV = 'production';

    mockPut.mockResolvedValue({
      url: 'https://blob.vercel-storage.com/job-456.json',
      pathname: 'damilola.tech/resume-generations/production/job-456.json',
    });

    const { POST } = await import('@/app/api/v1/resume-generator/log/route');
    const request = new Request('http://localhost/api/v1/resume-generator/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLogData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.jobId).toBe('job-456');
    expect(data.data.isUpdate).toBe(false);
    expect(mockPut).toHaveBeenCalledWith(
      'damilola.tech/resume-generations/production/job-456.json',
      expect.any(String),
      { access: 'public', contentType: 'application/json' }
    );
    expect(mockLogApiAccess).toHaveBeenCalledWith(
      'api_generation_logged',
      mockValidApiKey.apiKey,
      expect.objectContaining({ jobId: 'job-456', isUpdate: false }),
      '127.0.0.1'
    );
  });

  it('updates an existing record and appends history', async () => {
    mockList.mockResolvedValue({
      blobs: [
        {
          url: 'https://blob.vercel-storage.com/existing.json',
          pathname: 'damilola.tech/resume-generations/preview/job-456.json',
        },
      ],
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        version: 2,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        generationId: 'gen-old',
        jobId: 'job-456',
        jobIdentifier: { type: 'url', hash: 'abc123' },
        environment: 'preview',
        inputType: 'text',
        companyName: 'Acme Corp',
        roleTitle: 'Engineer',
        jobDescriptionFull: 'old',
        estimatedCompatibility: {
          before: 50,
          after: 60,
          breakdown: {
            keywordRelevance: 20,
            skillsQuality: 15,
            experienceAlignment: 15,
            contentQuality: 10,
          },
        },
        changesAccepted: [],
        changesRejected: [],
        gapsIdentified: [],
        pdfUrl: 'https://blob.vercel-storage.com/old.pdf',
        optimizedResumeJson: {},
        generationHistory: [],
        applicationStatus: 'draft',
      }),
    } as Response);

    mockPut.mockResolvedValue({
      url: 'https://blob.vercel-storage.com/job-456.json',
      pathname: 'damilola.tech/resume-generations/preview/job-456.json',
    });

    const { POST } = await import('@/app/api/v1/resume-generator/log/route');
    const request = new Request('http://localhost/api/v1/resume-generator/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLogData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.isUpdate).toBe(true);
    expect(data.data.generationCount).toBe(2);
  });

  it('handles storage errors gracefully', async () => {
    mockPut.mockRejectedValue(new Error('Blob write failed'));

    const { POST } = await import('@/app/api/v1/resume-generator/log/route');
    const request = new Request('http://localhost/api/v1/resume-generator/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validLogData),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
  });
});
