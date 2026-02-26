import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerGetResumeData(server: McpServer, client: ApiClient) {
  server.tool(
    'get_resume_data',
    'Fetch raw resume JSON data for external consumption.',
    {},
    async () => {
      try {
        const result = await client.getResumeData();
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
