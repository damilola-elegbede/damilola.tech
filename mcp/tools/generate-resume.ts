import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerGenerateResume(server: McpServer, client: ApiClient) {
  server.tool(
    'generate_resume',
    'Generate a full ATS-optimized resume response from a job description URL or text.',
    {
      input: z.string().describe('Job description text or URL'),
    },
    async ({ input }) => {
      try {
        const result = await client.generateResume(input);
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
