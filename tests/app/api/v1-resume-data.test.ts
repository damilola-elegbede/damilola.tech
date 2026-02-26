/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

const mockLogApiAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

const mockFetchAllContent = vi.fn();
vi.mock('@/lib/blob', () => ({
  fetchAllContent: (...args: unknown[]) => mockFetchAllContent(...args),
}));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

describe('v1/resume-data API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRequireApiKey.mockResolvedValue({
      apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
    });
    mockFetchAllContent.mockResolvedValue({
      resume: '{"name":"Damilola"}',
      starStories: '{}',
      leadershipPhilosophy: '',
      technicalExpertise: '',
      verilyFeedback: '',
      anecdotes: '',
      projectsContext: '',
      chatbotArchitecture: '',
    });
  });

  describe('authentication', () => {
    it('returns 401 when API key is missing', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'missing' } }, { status: 401 })
      );

      const { GET } = await import('@/app/api/v1/resume-data/route');
      const response = await GET(new Request('http://localhost/api/v1/resume-data'));
      expect(response.status).toBe(401);
    });

    it('returns 401 when API key is invalid', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'invalid' } }, { status: 401 })
      );

      const { GET } = await import('@/app/api/v1/resume-data/route');
      const response = await GET(new Request('http://localhost/api/v1/resume-data'));
      expect(response.status).toBe(401);
    });

    it('returns 403 when API key is revoked', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'revoked' } }, { status: 403 })
      );

      const { GET } = await import('@/app/api/v1/resume-data/route');
      const response = await GET(new Request('http://localhost/api/v1/resume-data'));
      expect(response.status).toBe(403);
    });
  });

  it('returns resume JSON in apiSuccess envelope', async () => {
    const { GET } = await import('@/app/api/v1/resume-data/route');
    const response = await GET(new Request('http://localhost/api/v1/resume-data'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({ name: 'Damilola' });
    expect(mockLogApiAccess).toHaveBeenCalledWith(
      'api_resume_data_accessed',
      expect.any(Object),
      expect.any(Object),
      '127.0.0.1'
    );
  });

  it('returns 500 when resume is unavailable', async () => {
    mockFetchAllContent.mockResolvedValue({
      resume: '',
      starStories: '{}',
      leadershipPhilosophy: '',
      technicalExpertise: '',
      verilyFeedback: '',
      anecdotes: '',
      projectsContext: '',
      chatbotArchitecture: '',
    });

    const { GET } = await import('@/app/api/v1/resume-data/route');
    const response = await GET(new Request('http://localhost/api/v1/resume-data'));

    expect(response.status).toBe(500);
  });

  it('returns 500 when blob fetch fails', async () => {
    mockFetchAllContent.mockRejectedValue(new Error('blob failure'));

    const { GET } = await import('@/app/api/v1/resume-data/route');
    const response = await GET(new Request('http://localhost/api/v1/resume-data'));

    expect(response.status).toBe(500);
  });
});
