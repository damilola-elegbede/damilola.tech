import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerScoreResume(server: McpServer, client: ApiClient) {
  server.tool(
    'score_resume',
    'Run ATS scoring plus AI gap analysis for a job description URL or text.',
    {
      input: z.string().describe('Job description text or URL'),
    },
    async ({ input }) => {
      try {
        const result = await client.scoreResume(input);
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
