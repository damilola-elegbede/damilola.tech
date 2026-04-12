import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerScoreJob(server: McpServer, client: ApiClient) {
  server.tool(
    'score_job',
    'Score a job posting against Damilola\'s resume for fit and readiness. Returns readiness score, gap analysis, and recommendation.',
    {
      url: z.string().url().describe('Job posting URL'),
      title: z.string().describe('Job title'),
      company: z.string().describe('Company name'),
    },
    async ({ url, title, company }) => {
      try {
        const result = await client.scoreJob(url, title, company);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        };
      }
    }
  );
}
