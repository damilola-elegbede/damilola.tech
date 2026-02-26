import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerModifyChange(server: McpServer, client: ApiClient) {
  server.tool(
    'modify_change',
    'AI-refine a specific proposed resume change.',
    {
      originalChange: z.object({
        section: z.string(),
        original: z.string(),
        modified: z.string(),
        reason: z.string(),
        keywordsAdded: z.array(z.string()),
        impactPoints: z.number(),
      }),
      modifyPrompt: z.string().describe('Instructions for how to revise the change'),
      jobDescription: z.string().describe('Full job description text for context'),
    },
    async ({ originalChange, modifyPrompt, jobDescription }) => {
      try {
        const result = await client.modifyChange({ originalChange, modifyPrompt, jobDescription });
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
