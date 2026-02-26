import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerUpdateApplicationStatus(server: McpServer, client: ApiClient) {
  server.tool(
    'update_application_status',
    'Update application status metadata for a stored resume generation record.',
    {
      id: z.string().describe('Blob pathname/URL ID for the resume generation'),
      applicationStatus: z.string().optional().describe('Application status'),
      appliedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Applied date (YYYY-MM-DD)'),
      notes: z.string().optional().describe('Optional notes'),
    },
    async ({ id, applicationStatus, appliedDate, notes }) => {
      try {
        if (applicationStatus === undefined && appliedDate === undefined && notes === undefined) {
          return {
            content: [{ type: 'text' as const, text: 'Error: At least one field must be provided to update.' }],
            isError: true,
          };
        }

        const result = await client.updateApplicationStatus(id, {
          applicationStatus,
          appliedDate,
          notes,
        });
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
