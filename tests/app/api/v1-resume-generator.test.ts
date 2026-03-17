/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockRequireApiKey = vi.fn();
vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

const mockLogApiAccess = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api-audit', () => ({
  logApiAccess: (...args: unknown[]) => mockLogApiAccess(...args),
}));

const mockCheckGenericRateLimit = vi.fn();
vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  checkGenericRateLimit: (...args: unknown[]) => mockCheckGenericRateLimit(...args),
  RATE_LIMIT_CONFIGS: {
    resumeGenerator: { key: 'resume-generator', limit: 10, windowSeconds: 3600 },
  },
}));

const mockCalculateReadinessScore = vi.fn();
const mockResumeDataToText = vi.fn();
vi.mock('@/lib/readiness-scorer', () => ({
  calculateReadinessScore: (...args: unknown[]) => mockCalculateReadinessScore(...args),
  resumeDataToText: (...args: unknown[]) => mockResumeDataToText(...args),
}));

vi.mock('@/lib/resume-data', () => ({
  resumeData: {
    title: 'Engineering Manager',
    name: 'Damilola',
    brandingStatement: 'Summary',
    skills: [{ category: 'Cloud', items: ['AWS', 'GCP'] }],
    experiences: [{ title: 'EM', company: 'Verily', highlights: ['Did thing'] }],
    education: [{ degree: 'MBA', institution: 'School' }],
  },
}));

vi.mock('@/lib/resume-generator-prompt', () => ({
  getResumeGeneratorPrompt: vi.fn().mockResolvedValue('Mock resume system prompt'),
}));

vi.mock('@/lib/generated/system-prompt', () => ({
  RESUME_GENERATOR_PROMPT: 'Mock resume system prompt',
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

describe('v1/resume-generator API route', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    global.fetch = vi.fn();
    mockRequireApiKey.mockResolvedValue({
      apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
    });
    mockCheckGenericRateLimit.mockResolvedValue({ limited: false, remaining: 9 });
    mockResumeDataToText.mockReturnValue('resume text');
    mockCalculateReadinessScore.mockReturnValue({
      total: 64,
      breakdown: {
        roleRelevance: 25,
        claritySkimmability: 18,
        businessImpact: 14,
        presentationQuality: 7,
      },
      isOptimized: true,
      details: {
        matchedKeywords: ['cloud', 'kubernetes'],
        missingKeywords: ['terraform', 'cost optimization'],
        matchRate: 45.2,
        keywordDensity: 2.1,
      },
    });
    mockCreate.mockResolvedValue({
      model: 'claude-opus-4-6',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{
        type: 'text',
        text: JSON.stringify({
          analysis: { companyName: 'Acme', roleTitle: 'Senior EM' },
          currentScore: {
            total: 64,
            breakdown: {
              roleRelevance: 25,
              claritySkimmability: 18,
              businessImpact: 14,
              presentationQuality: 7,
            },
          },
          optimizedScore: {
            total: 83,
            breakdown: {
              roleRelevance: 33,
              claritySkimmability: 21,
              businessImpact: 18,
              presentationQuality: 9,
            },
          },
          proposedChanges: [
            {
              section: 'experience.verily.bullet1',
              original: 'old',
              modified: 'new',
              reason: 'added key terms',
              relevanceSignals: ['terraform'],
              impactPoints: 5,
              impactPerSignal: 5,
              impactBreakdown: {
                roleRelevance: 3,
                claritySkimmability: 1,
                businessImpact: 1,
                presentationQuality: 0,
              },
            },
          ],
          gaps: [{ requirement: 'Cost optimization' }],
          scoreCeiling: { maximum: 89 },
        }),
      }],
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('authentication', () => {
    it('returns 401 when API key is missing', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'missing' } }, { status: 401 })
      );

      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const response = await POST(new Request('http://localhost/api/v1/resume-generator', { method: 'POST' }));
      expect(response.status).toBe(401);
    });

    it('returns 401 when API key is invalid', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'invalid' } }, { status: 401 })
      );

      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const response = await POST(new Request('http://localhost/api/v1/resume-generator', { method: 'POST' }));
      expect(response.status).toBe(401);
    });

    it('returns 403 when API key is revoked', async () => {
      mockRequireApiKey.mockResolvedValue(
        Response.json({ success: false, error: { code: 'FORBIDDEN', message: 'revoked' } }, { status: 403 })
      );

      const { POST } = await import('@/app/api/v1/resume-generator/route');
      const response = await POST(new Request('http://localhost/api/v1/resume-generator', { method: 'POST' }));
      expect(response.status).toBe(403);
    });
  });

  it('returns 400 for missing input', async () => {
    const { POST } = await import('@/app/api/v1/resume-generator/route');
    const response = await POST(
      new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    );

    expect(response.status).toBe(400);
  });

  it('returns full JSON generation payload (non-streaming)', async () => {
    const { POST } = await import('@/app/api/v1/resume-generator/route');
    const response = await POST(
      new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'JD text with requirements and responsibilities' }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(data.success).toBe(true);
    expect(data.data.generationId).toBeDefined();
    expect(data.data.companyName).toBe('Acme');
    expect(data.data.roleTitle).toBe('Senior EM');
    expect(data.data.currentScore.total).toBe(64);
    expect(data.data.optimizedScore.total).toBe(83);
    // maxPossibleScore = computePossibleMaxScore(64, [{impactPoints:5}], {maximum:89})
    // = min(89, 64+5) = 69
    expect(data.data.maxPossibleScore).toBe(69);
    expect(data.data.proposedChanges).toHaveLength(1);
    expect(data.data.proposedChanges[0].impactBreakdown).toEqual({
      roleRelevance: 3,
      claritySkimmability: 1,
      businessImpact: 1,
      presentationQuality: 0,
    });
    expect(data.data.proposedChanges[0].impactPerSignal).toBe(5);
    expect(data.data.inputType).toBe('text');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockLogApiAccess).toHaveBeenCalledWith(
      'api_resume_generation',
      expect.any(Object),
      expect.objectContaining({ inputType: 'text', currentScore: 64 }),
      '127.0.0.1'
    );
  });

  it('handles changes without impactBreakdown (backward compat)', async () => {
    mockCreate.mockResolvedValue({
      model: 'claude-opus-4-6',
      usage: { input_tokens: 10, output_tokens: 10 },
      content: [{
        type: 'text',
        text: JSON.stringify({
          analysis: { companyName: 'Legacy Co', roleTitle: 'EM' },
          optimizedScore: { total: 72, breakdown: { roleRelevance: 28, claritySkimmability: 20, businessImpact: 16, presentationQuality: 8 } },
          proposedChanges: [
            {
              section: 'summary',
              original: 'old summary',
              modified: 'new summary',
              reason: 'improved',
              relevanceSignals: ['leadership'],
              impactPoints: 8,
              // no impactBreakdown, no impactPerSignal
            },
          ],
          gaps: [],
        }),
      }],
    });

    const { POST } = await import('@/app/api/v1/resume-generator/route');
    const response = await POST(
      new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'JD text with requirements and responsibilities' }),
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.proposedChanges[0].impactBreakdown).toBeUndefined();
    expect(data.data.proposedChanges[0].impactPerSignal).toBeUndefined();
    // maxPossibleScore = min(100, 64+8) = 72
    expect(data.data.maxPossibleScore).toBe(72);
  });

  it('returns 429 when rate limited', async () => {
    mockCheckGenericRateLimit.mockResolvedValue({ limited: true, remaining: 0, retryAfter: 60 });

    const { POST } = await import('@/app/api/v1/resume-generator/route');
    const response = await POST(
      new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'JD text' }),
      })
    );

    expect(response.status).toBe(429);
  });

  it('returns 500 on Anthropic failure', async () => {
    mockCreate.mockRejectedValue(new Error('Anthropic down'));

    const { POST } = await import('@/app/api/v1/resume-generator/route');
    const response = await POST(
      new Request('http://localhost/api/v1/resume-generator', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'JD text' }),
      })
    );

    expect(response.status).toBe(500);
  });

  it('exports maxDuration = 120', async () => {
    const route = await import('@/app/api/v1/resume-generator/route');
    expect(route.maxDuration).toBe(120);
  });
});
