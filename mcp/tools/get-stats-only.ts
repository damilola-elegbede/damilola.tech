import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerGetStatsOnly(server: McpServer, client: ApiClient) {
  server.tool(
    'get_stats',
    'Get application stats only.',
    {
      env: z.string().optional().describe('Environment filter for stats'),
    },
    async ({ env }) => {
      try {
        const result = await client.getStatsOnly({ env });
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
