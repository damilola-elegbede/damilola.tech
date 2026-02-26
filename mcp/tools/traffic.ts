import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerTraffic(server: McpServer, client: ApiClient) {
  server.tool(
    'get_traffic',
    'Get traffic analytics breakdown by source, campaign, and landing page.',
    {
      env: z.string().optional().describe('Environment filter'),
      startDate: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      endDate: z.string().optional().describe('End date (YYYY-MM-DD)'),
    },
    async ({ env, startDate, endDate }) => {
      try {
        const result = await client.getTraffic({ env, startDate, endDate });
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
