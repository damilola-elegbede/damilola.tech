import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerUploadResumePdf(server: McpServer, client: ApiClient) {
  server.tool(
    'upload_resume_pdf',
    'Upload a generated resume PDF (base64 encoded) to blob storage.',
    {
      pdfBase64: z.string().describe('Base64-encoded PDF content'),
      companyName: z.string(),
      roleTitle: z.string(),
    },
    async ({ pdfBase64, companyName, roleTitle }) => {
      try {
        const result = await client.uploadResumePdf({ pdfBase64, companyName, roleTitle });
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
