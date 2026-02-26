import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ApiClient } from '../lib/api-client.js';

export function registerLogGeneration(server: McpServer, client: ApiClient) {
  server.tool(
    'log_generation',
    'Save or update a resume generation log record.',
    {
      generationId: z.string(),
      jobId: z.string(),
      jobIdentifier: z.record(z.string(), z.unknown()),
      companyName: z.string(),
      roleTitle: z.string(),
      jobDescriptionFull: z.string(),
      datePosted: z.string().optional(),
      inputType: z.string().optional(),
      extractedUrl: z.string().optional(),
      estimatedCompatibility: z.record(z.string(), z.unknown()).optional(),
      changesAccepted: z.array(z.unknown()).optional(),
      changesRejected: z.array(z.unknown()).optional(),
      gapsIdentified: z.array(z.unknown()).optional(),
      pdfUrl: z.string().optional(),
      optimizedResumeJson: z.record(z.string(), z.unknown()).optional(),
    },
    async (params) => {
      try {
        const result = await client.logGeneration(params);
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
