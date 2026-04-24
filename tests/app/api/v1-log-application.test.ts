/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock api-key-auth
const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

// Mock applications-store
const mockSaveApplication = vi.fn();
vi.mock('@/lib/applications-store', () => ({
  saveApplication: (...args: unknown[]) => mockSaveApplication(...args),
}));

// Mock crypto.randomUUID so IDs are deterministic in tests
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>();
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue('test-uuid-1234'),
  };
});

describe('POST /api/v1/log-application', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  const validBody = {
    company: 'Anthropic',
    title: 'Staff Software Engineer',
    url: 'https://boards.greenhouse.io/anthropic/jobs/123',
    role_id: 'role-abc',
    score: 91,
    notes: 'Applied via referral',
    applied_at: '2026-04-23T14:00:00Z',
    status: 'applied',
  };

  // --- Authentication ---

  describe('authentication', () => {
    it('returns 401 without API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
          { status: 401 }
        )
      );

      const { POST } = await import('@/app/api/v1/log-application/route');
      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });
      const res = await POST(req);

      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 with revoked API key', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'API key has been revoked' } },
          { status: 403 }
        )
      );

      const { POST } = await import('@/app/api/v1/log-application/route');
      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });
      const res = await POST(req);

      expect(res.status).toBe(403);
    });
  });

  // --- Validation ---

  describe('validation', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns 400 when company is missing', async () => {
      mockSaveApplication.mockResolvedValue(undefined);
      const { POST } = await import('@/app/api/v1/log-application/route');

      const body = { ...validBody };
      delete (body as Partial<typeof validBody>).company;

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('company');
    });

    it('returns 400 when title is missing', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const body = { ...validBody };
      delete (body as Partial<typeof validBody>).title;

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error.message).toContain('title');
    });

    it('returns 400 when company is empty string', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, company: '' }),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('returns 422 with an invalid status value', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, status: 'pending' }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(422);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('pending');
    });

    it('returns 400 when score is out of range (> 100)', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, score: 101 }),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('returns 400 when score is negative', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, score: -1 }),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid applied_at format', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, applied_at: 'not-a-date' }),
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid JSON body', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not-json',
      });
      const res = await POST(req);

      expect(res.status).toBe(400);
    });
  });

  // --- Happy path ---

  describe('success cases', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
      mockSaveApplication.mockResolvedValue(undefined);
    });

    it('returns 201 with all required fields on valid request', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data).toMatchObject({
        id: 'test-uuid-1234',
        company: 'Anthropic',
        title: 'Staff Software Engineer',
        applied_at: '2026-04-23T14:00:00Z',
        status: 'applied',
        score: 91,
        url: 'https://boards.greenhouse.io/anthropic/jobs/123',
      });
    });

    it('defaults applied_at to now when not provided', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const body = { company: 'Stripe', title: 'Staff Engineer' };
      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const before = Date.now();
      const res = await POST(req);
      const after = Date.now();
      const data = await res.json();

      expect(res.status).toBe(201);
      const appliedMs = new Date(data.data.applied_at as string).getTime();
      expect(appliedMs).toBeGreaterThanOrEqual(before);
      expect(appliedMs).toBeLessThanOrEqual(after);
    });

    it('defaults status to "applied" when not provided', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const body = { company: 'Stripe', title: 'Staff Engineer' };
      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(data.data.status).toBe('applied');
    });

    it('accepts optional fields as null/omitted', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const body = { company: 'Netflix', title: 'Principal Engineer' };
      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.data.url).toBeNull();
      expect(data.data.score).toBeNull();
    });

    it('calls saveApplication with correct shape', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });
      await POST(req);

      expect(mockSaveApplication).toHaveBeenCalledOnce();
      const saved = mockSaveApplication.mock.calls[0][0] as Record<string, unknown>;
      expect(saved).toMatchObject({
        id: 'test-uuid-1234',
        company: 'Anthropic',
        title: 'Staff Software Engineer',
        status: 'applied',
      });
      expect(saved['created_at']).toBeDefined();
      expect(saved['updated_at']).toBeDefined();
    });

    it('accepts score of 0 (boundary)', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, score: 0 }),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(201);
      expect(data.data.score).toBe(0);
    });

    it('accepts score of 100 (boundary)', async () => {
      const { POST } = await import('@/app/api/v1/log-application/route');

      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, score: 100 }),
      });
      const res = await POST(req);

      expect(res.status).toBe(201);
    });

    it('accepts all valid status values', async () => {
      const statuses = ['applied', 'screen', 'interview', 'offer', 'rejected', 'withdrawn'];
      for (const status of statuses) {
        vi.resetModules();
        vi.clearAllMocks();
        mockRequireApiKey.mockResolvedValue(mockValidApiKey);
        mockSaveApplication.mockResolvedValue(undefined);

        const { POST: POSTfresh } = await import('@/app/api/v1/log-application/route');
        const req = new Request('http://localhost/api/v1/log-application', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...validBody, status }),
        });
        const res = await POSTfresh(req);
        expect(res.status).toBe(201);
      }
    });
  });

  // --- Error handling ---

  describe('error handling', () => {
    beforeEach(() => {
      mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    });

    it('returns 500 when saveApplication throws', async () => {
      mockSaveApplication.mockRejectedValue(new Error('Redis unavailable'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { POST } = await import('@/app/api/v1/log-application/route');
      const req = new Request('http://localhost/api/v1/log-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      });
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error.code).toBe('INTERNAL_ERROR');

      consoleSpy.mockRestore();
    });
  });
});
