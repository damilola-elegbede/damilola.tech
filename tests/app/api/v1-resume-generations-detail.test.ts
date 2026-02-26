/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

const mockLogAdminEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: (...args: unknown[]) => mockLogAdminEvent(...args),
}));

const mockPut = vi.fn();
vi.mock('@vercel/blob', () => ({
  put: (...args: unknown[]) => mockPut(...args),
}));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/resume-generations/[id] API route', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    global.fetch = vi.fn();
    mockRequireApiKey.mockResolvedValue({
      apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const createParams = (id: string) => ({
    params: Promise.resolve({ id }),
  });

  const encodedBlobUrl = encodeURIComponent(
    'https://abc.blob.vercel-storage.com/damilola.tech/resume-generations/preview/job-1.json'
  );

  describe('authentication', () => {
    it('returns 401 without API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const request = new Request('http://localhost/api/v1/resume-generations/test-id');
      const response = await GET(request, createParams('test-id'));

      expect(response.status).toBe(401);
    });

    it('returns 401 for invalid API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid API key.' } },
          { status: 401 }
        )
      );

      const { PATCH } = await import('@/app/api/v1/resume-generations/[id]/route');
      const request = new Request('http://localhost/api/v1/resume-generations/test-id', { method: 'PATCH' });
      const response = await PATCH(request, createParams('test-id'));

      expect(response.status).toBe(401);
    });

    it('returns 403 for revoked API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'API key has been revoked.' } },
          { status: 403 }
        )
      );

      const { PATCH } = await import('@/app/api/v1/resume-generations/[id]/route');
      const request = new Request('http://localhost/api/v1/resume-generations/test-id', { method: 'PATCH' });
      const response = await PATCH(request, createParams('test-id'));

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/v1/resume-generations/[id]', () => {
    it('returns generation content', async () => {
      const generationData = { version: 2, generationId: 'gen-1', companyName: 'Tech Corp' };

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => generationData,
      } as Response);

      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const request = new Request(`http://localhost/api/v1/resume-generations/${encodedBlobUrl}`);
      const response = await GET(request, createParams(encodedBlobUrl));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(generationData);
    });

    it('returns 400 for invalid blob URL', async () => {
      const { GET } = await import('@/app/api/v1/resume-generations/[id]/route');
      const bad = encodeURIComponent('https://evil.com/data.json');
      const response = await GET(new Request('http://localhost/test'), createParams(bad));
      expect(response.status).toBe(400);
    });
  });

  describe('PATCH /api/v1/resume-generations/[id]', () => {
    it('updates provided fields and writes back to blob', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ version: 2, applicationStatus: 'draft', notes: '' }),
      } as Response);
      mockPut.mockResolvedValue({
        url: 'https://abc.blob.vercel-storage.com/damilola.tech/resume-generations/preview/job-1.json',
      });

      const { PATCH } = await import('@/app/api/v1/resume-generations/[id]/route');
      const response = await PATCH(
        new Request(`http://localhost/api/v1/resume-generations/${encodedBlobUrl}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ applicationStatus: 'applied', appliedDate: '2026-02-25', notes: 'Applied via Workday' }),
        }),
        createParams(encodedBlobUrl)
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.applicationStatus).toBe('applied');
      expect(data.data.appliedDate).toBe('2026-02-25');
      expect(data.data.notes).toBe('Applied via Workday');
      expect(mockPut).toHaveBeenCalledWith(
        'damilola.tech/resume-generations/preview/job-1.json',
        expect.any(String),
        expect.objectContaining({ allowOverwrite: true, contentType: 'application/json' })
      );
      expect(mockLogAdminEvent).toHaveBeenCalledWith(
        'api_resume_generation_status_updated',
        expect.any(Object),
        '127.0.0.1',
        expect.objectContaining({ accessType: 'api', apiKeyId: 'key-1' })
      );
    });

    it('returns 400 for invalid status', async () => {
      const { PATCH } = await import('@/app/api/v1/resume-generations/[id]/route');
      const response = await PATCH(
        new Request('http://localhost/api/v1/resume-generations/x', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ applicationStatus: 'unknown' }),
        }),
        createParams(encodedBlobUrl)
      );

      expect(response.status).toBe(400);
    });

    it('returns 404 when generation does not exist', async () => {
      vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 404 } as Response);

      const { PATCH } = await import('@/app/api/v1/resume-generations/[id]/route');
      const response = await PATCH(
        new Request('http://localhost/api/v1/resume-generations/x', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ notes: 'abc' }),
        }),
        createParams(encodedBlobUrl)
      );

      expect(response.status).toBe(404);
    });

    it('returns 500 on blob write failure', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ version: 2, applicationStatus: 'draft' }),
      } as Response);
      mockPut.mockRejectedValue(new Error('write failed'));

      const { PATCH } = await import('@/app/api/v1/resume-generations/[id]/route');
      const response = await PATCH(
        new Request('http://localhost/api/v1/resume-generations/x', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ notes: 'abc' }),
        }),
        createParams(encodedBlobUrl)
      );

      expect(response.status).toBe(500);
    });
  });
});
