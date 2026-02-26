import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { requireApiKey } from '@/lib/api-key-auth';
import { logAdminEvent } from '@/lib/audit-server';
import {
  RATE_LIMIT_CONFIGS,
  checkGenericRateLimit,
  createRateLimitResponse,
  getClientIp,
} from '@/lib/rate-limit';
import { createMcpServer } from '@/lib/mcp/create-mcp-server';
import { getTrustedApiBaseUrl } from '@/lib/mcp/get-trusted-api-base-url';

export const runtime = 'nodejs';
export const maxDuration = 120;

function getRawApiKey(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  const apiKeyHeader = req.headers.get('X-API-Key');
  if (apiKeyHeader) {
    return apiKeyHeader.trim();
  }

  return null;
}


export async function POST(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);
  const rawApiKey = getRawApiKey(req);
  if (!rawApiKey) {
    return new Response('Unauthorized', { status: 401 });
  }

  const rateLimit = await checkGenericRateLimit(
    RATE_LIMIT_CONFIGS.mcp,
    `${authResult.apiKey.id}:${ip}`
  );
  if (rateLimit.limited) {
    return createRateLimitResponse(rateLimit);
  }

  try {
    const apiBaseUrl = getTrustedApiBaseUrl();
    const server = createMcpServer(rawApiKey, apiBaseUrl);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    await server.connect(transport);
    const response = await transport.handleRequest(req);

    try {
      await logAdminEvent('api_mcp_request', { method: 'POST' }, ip, {
        accessType: 'api',
        apiKeyId: authResult.apiKey.id,
        apiKeyName: authResult.apiKey.name,
      });
    } catch {
      // Non-fatal
    }

    return response;
  } catch (error) {
    console.error('[api/mcp] Error:', error);
    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function GET(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const ip = getClientIp(req);
    const rawApiKey = getRawApiKey(req);
    if (!rawApiKey) {
      return new Response('Unauthorized', { status: 401 });
    }

    const rateLimit = await checkGenericRateLimit(
      RATE_LIMIT_CONFIGS.mcp,
      `${authResult.apiKey.id}:${ip}`
    );
    if (rateLimit.limited) {
      return createRateLimitResponse(rateLimit);
    }

    const apiBaseUrl = getTrustedApiBaseUrl();
    const server = createMcpServer(rawApiKey, apiBaseUrl);

    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    return await transport.handleRequest(req);
  } catch (error) {
    console.error('[api/mcp] SSE Error:', error);
    return new Response('Internal server error', { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  return new Response(null, { status: 200 });
}
