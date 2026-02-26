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

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}));

const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: (...args: unknown[]) => mockCreate(...args),
    };
  },
}));

describe('v1/resume-generator/modify-change API route', () => {
  const mockValidApiKey = {
    apiKey: { id: 'key-1', name: 'Test Key', enabled: true },
  };

  const validBody = {
    originalChange: {
      section: 'experience.verily.bullet1',
      original: 'Built infra',
      modified: 'Built Terraform infrastructure',
      reason: 'Adds ATS keywords',
      keywordsAdded: ['terraform'],
      impactPoints: 5,
    },
    modifyPrompt: 'Make it concise',
    jobDescription: 'Job description text',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRequireApiKey.mockResolvedValue(mockValidApiKey);
    mockLogApiAccess.mockResolvedValue(undefined);
  });

  it('returns auth response when API key is missing/invalid', async () => {
    mockRequireApiKey.mockResolvedValue(
      Response.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'API key required' } },
        { status: 401 }
      )
    );

    const { POST } = await import('@/app/api/v1/resume-generator/modify-change/route');
    const request = new Request('http://localhost/api/v1/resume-generator/modify-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('validates required fields', async () => {
    const { POST } = await import('@/app/api/v1/resume-generator/modify-change/route');
    const request = new Request('http://localhost/api/v1/resume-generator/modify-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modifyPrompt: 'x' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('BAD_REQUEST');
  });

  it('returns revised change on happy path', async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            section: 'experience.verily.bullet1',
            original: 'Built infra',
            modified: 'Built Terraform infra supporting 12 services',
            reason: 'Concise and metrics-focused',
            keywordsAdded: ['terraform'],
            impactPoints: 5,
          }),
        },
      ],
    });

    const { POST } = await import('@/app/api/v1/resume-generator/modify-change/route');
    const request = new Request('http://localhost/api/v1/resume-generator/modify-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.revisedChange.modified).toContain('12 services');
    expect(mockLogApiAccess).toHaveBeenCalledWith(
      'api_modify_change',
      mockValidApiKey.apiKey,
      expect.objectContaining({
        section: 'experience.verily.bullet1',
      }),
      '127.0.0.1'
    );
  });

  it('handles invalid AI JSON response', async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not-json' }],
    });

    const { POST } = await import('@/app/api/v1/resume-generator/modify-change/route');
    const request = new Request('http://localhost/api/v1/resume-generator/modify-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INTERNAL_ERROR');
    expect(data.error.message).toContain('Failed to parse AI response as JSON');
  });

  it('handles upstream AI errors', async () => {
    mockCreate.mockRejectedValue(new Error('Claude unavailable'));

    const { POST } = await import('@/app/api/v1/resume-generator/modify-change/route');
    const request = new Request('http://localhost/api/v1/resume-generator/modify-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error.message).toBe('AI service error');
  });
});
