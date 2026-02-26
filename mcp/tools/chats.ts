import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerChats(server: McpServer, client: ApiClient) {
  server.tool(
    'list_chats',
    'List stored chat sessions.',
    {
      env: z.string().optional().describe('Environment filter'),
      limit: z.number().optional().describe('Maximum results to return'),
      cursor: z.string().optional().describe('Pagination cursor'),
    },
    async ({ env, limit, cursor }) => {
      try {
        const result = await client.listChats({ env, limit, cursor });
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

  server.tool(
    'get_chat',
    'Retrieve a specific chat session by blob pathname or URL.',
    {
      id: z.string().describe('Chat blob pathname or URL'),
    },
    async ({ id }) => {
      try {
        const result = await client.getChat(id);
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
