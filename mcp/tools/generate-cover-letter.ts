import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerGenerateCoverLetter(server: McpServer, client: ApiClient) {
  server.tool(
    'generate_cover_letter',
    'Generate a targeted cover letter for a job posting. Uses score_job output for fit context.',
    {
      job_posting_url: z.string().url().describe('URL of the job posting').optional(),
      job_posting_text: z.string().describe('Raw job posting text, if URL fetch is blocked').optional(),
      score_job_output: z.string().describe('JSON output from score_job for this role (optional but recommended)').optional(),
      tone: z.enum(['confident', 'warm', 'technical']).default('confident').describe('Cover letter tone'),
      company: z.string().describe('Company name for output filename').optional(),
      role: z.string().describe('Role title for output filename').optional(),
    },
    async (input) => {
      try {
        const result = await client.generateCoverLetter(input);
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
