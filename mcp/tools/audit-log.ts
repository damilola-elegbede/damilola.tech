import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerAuditLog(server: McpServer, client: ApiClient) {
  server.tool(
    'get_audit_log',
    'List audit log entries.',
    {
      env: z.string().optional().describe('Environment filter'),
      eventType: z.string().optional().describe('Filter by event type'),
      limit: z.number().optional().describe('Maximum results to return'),
      cursor: z.string().optional().describe('Pagination cursor'),
    },
    async ({ env, eventType, limit, cursor }) => {
      try {
        const result = await client.getAuditLog({ env, eventType, limit, cursor });
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
