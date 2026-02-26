/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireApiKey = vi.fn();
const mockLogAdminEvent = vi.fn();
const mockCheckGenericRateLimit = vi.fn();

const ORIGINAL_ENV = { ...process.env };

vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: (...args: unknown[]) => mockLogAdminEvent(...args),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMIT_CONFIGS: {
    mcp: { key: 'mcp', limit: 60, windowSeconds: 60 },
  },
  getClientIp: vi.fn(() => '127.0.0.1'),
  checkGenericRateLimit: (...args: unknown[]) => mockCheckGenericRateLimit(...args),
  createRateLimitResponse: (result: { retryAfter?: number }) =>
    Response.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(result?.retryAfter || 60) },
      }
    ),
}));

describe('/api/mcp route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, API_BASE_URL: 'http://localhost' };
    mockCheckGenericRateLimit.mockResolvedValue({ limited: false, remaining: 59 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns 401 when API key is missing', async () => {
    mockRequireApiKey.mockResolvedValueOnce(
      Response.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'API key required' },
        },
        { status: 401 }
      )
    );

    const { POST } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when API key is invalid', async () => {
    mockRequireApiKey.mockResolvedValueOnce(
      Response.json(
        {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Invalid API key' },
        },
        { status: 401 }
      )
    );

    const { POST } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('handles initialize request over POST', async () => {
    mockRequireApiKey.mockResolvedValueOnce({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });

    const { POST } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer dk_live_test',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.jsonrpc).toBe('2.0');
    expect(body.id).toBe(1);
    expect(body.result).toBeDefined();
    expect(mockLogAdminEvent).toHaveBeenCalledWith(
      'api_mcp_request',
      expect.objectContaining({ method: 'POST' }),
      '127.0.0.1',
      expect.objectContaining({
        accessType: 'api',
        apiKeyId: 'key-1',
        apiKeyName: 'Test Key',
      })
    );
    expect(mockCheckGenericRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'mcp' }),
      'key-1:127.0.0.1'
    );
  });

  it('accepts X-API-Key header auth path', async () => {
    mockRequireApiKey.mockResolvedValueOnce({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });

    const { POST } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'X-API-Key': 'dk_live_test',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('returns tools/list with 14+ tools', async () => {
    mockRequireApiKey.mockResolvedValue({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });

    const { POST } = await import('@/app/api/mcp/route');

    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer dk_live_test',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.result).toBeDefined();
    expect(Array.isArray(body.result.tools)).toBe(true);
    expect(body.result.tools.length).toBeGreaterThanOrEqual(14);
  });

  it('handles GET handler (SSE)', async () => {
    mockRequireApiKey.mockResolvedValueOnce({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });

    const { GET } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: 'Bearer dk_live_test',
      },
    });

    const res = await GET(req);
    // The transport implementation may vary in tests, but GET should not 500.
    expect(res.status).toBeLessThan(500);
    expect(mockCheckGenericRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: 'mcp' }),
      'key-1:127.0.0.1'
    );
  });

  it('returns 429 when rate limited', async () => {
    mockRequireApiKey.mockResolvedValueOnce({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });
    mockCheckGenericRateLimit.mockResolvedValueOnce({ limited: true, remaining: 0, retryAfter: 60 });

    const { POST } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer dk_live_test',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/list',
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns 200 for DELETE in stateless mode', async () => {
    mockRequireApiKey.mockResolvedValueOnce({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });

    const { DELETE } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer dk_live_test' },
    });
    const res = await DELETE(req);

    expect(res.status).toBe(200);
  });

  it('handles initialize request over POST with X-API-Key header', async () => {
    mockRequireApiKey.mockResolvedValueOnce({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });

    const { POST } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        'X-API-Key': 'dk_live_test',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' },
        },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('handles GET (SSE) requests', async () => {
    mockRequireApiKey.mockResolvedValueOnce({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });

    const { GET } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        'X-API-Key': 'dk_live_test',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('returns 429 when rate limited', async () => {
    mockRequireApiKey.mockResolvedValueOnce({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });

    mockCheckGenericRateLimit.mockResolvedValueOnce({
      limited: true,
      remaining: 0,
      retryAfter: 60,
    });

    const { POST } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer dk_live_test',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {},
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  it('returns JSON-RPC error for invalid request payload', async () => {
    mockRequireApiKey.mockResolvedValueOnce({
      apiKey: { id: 'key-1', name: 'Test Key', key: 'dk_live_test', enabled: true },
    });

    const { POST } = await import('@/app/api/mcp/route');
    const req = new Request('http://localhost/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        Authorization: 'Bearer dk_live_test',
      },
      body: JSON.stringify({
        foo: 'bar',
      }),
    });

    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBeLessThan(500);
    expect(body.jsonrpc).toBe('2.0');
    expect(body.error).toBeDefined();
    expect(typeof body.error.code).toBe('number');
  });
});
