import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ApiClient } from '../../../mcp/lib/api-client.js';
import { registerAssessFit } from '../../../mcp/tools/assess-fit.js';
import { registerFitAssessments } from '../../../mcp/tools/fit-assessments.js';
import { registerResumeGenerations } from '../../../mcp/tools/resume-generations.js';
import { registerGetStats } from '../../../mcp/tools/get-stats.js';
import { registerScoreResume } from '../../../mcp/tools/score-resume.js';
import { registerGenerateResume } from '../../../mcp/tools/generate-resume.js';
import { registerUpdateApplicationStatus } from '../../../mcp/tools/update-application-status.js';
import { registerGetResumeData } from '../../../mcp/tools/get-resume-data.js';
import { registerModifyChange } from '../../../mcp/tools/modify-change.js';
import { registerUploadResumePdf } from '../../../mcp/tools/upload-resume-pdf.js';
import { registerLogGeneration } from '../../../mcp/tools/log-generation.js';
import { registerGetStatsOnly } from '../../../mcp/tools/get-stats-only.js';
import { registerChats } from '../../../mcp/tools/chats.js';
import { registerAuditLog } from '../../../mcp/tools/audit-log.js';
import { registerTraffic } from '../../../mcp/tools/traffic.js';

export function createMcpServer(apiKey: string, apiBaseUrl: string): McpServer {
  const server = new McpServer({
    name: 'damilola-tech',
    version: '1.0.0',
  });

  const client = new ApiClient({ apiKey, baseUrl: apiBaseUrl });

  registerAssessFit(server, client);
  registerFitAssessments(server, client);
  registerResumeGenerations(server, client);
  registerGetStats(server, client);
  registerScoreResume(server, client);
  registerGenerateResume(server, client);
  registerUpdateApplicationStatus(server, client);
  registerGetResumeData(server, client);
  registerModifyChange(server, client);
  registerUploadResumePdf(server, client);
  registerLogGeneration(server, client);
  registerGetStatsOnly(server, client);
  registerChats(server, client);
  registerAuditLog(server, client);
  registerTraffic(server, client);

  return server;
}
