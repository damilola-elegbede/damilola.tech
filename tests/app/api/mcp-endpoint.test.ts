/**
 * @vitest-environment node
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRequireApiKey = vi.fn();
const mockLogAdminEvent = vi.fn();

vi.mock('@/lib/api-key-auth', () => ({
  requireApiKey: (req: Request) => mockRequireApiKey(req),
}));

vi.mock('@/lib/audit-server', () => ({
  logAdminEvent: (...args: unknown[]) => mockLogAdminEvent(...args),
}));

vi.mock('@/lib/rate-limit', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

describe('/api/mcp route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
