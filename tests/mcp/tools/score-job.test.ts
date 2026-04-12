import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { registerScoreJob } from '../../../mcp/tools/score-job.js';

type ToolHandler = (args: Record<string, unknown>) => Promise<{
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}>;

function createMockServer() {
  const tools: Record<string, ToolHandler> = {};
  return {
    tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: ToolHandler) => {
      tools[name] = handler;
    }),
    getHandler: (name: string) => tools[name],
  };
}

const mockScoreJobResult = {
  company: 'Acme Corp',
  title: 'Senior Software Engineer',
  url: 'https://example.com/jobs/senior-engineer',
  currentScore: {
    total: 75,
    breakdown: {
      roleRelevance: 22,
      claritySkimmability: 22,
      businessImpact: 18,
      presentationQuality: 13,
    },
    matchedKeywords: ['typescript', 'node'],
    missingKeywords: ['kubernetes'],
    matchRate: 70,
    keywordDensity: 5.0,
  },
  maxPossibleScore: 88,
  gapAnalysis: 'Strong fit with minor gaps.',
  recommendation: 'marginal_improvement' as const,
};

describe('score_job tool', () => {
  it('registers score_job tool', () => {
    const server = createMockServer();
    const client = { scoreJob: vi.fn() } as never;
    registerScoreJob(server as never, client);
    expect(server.tool).toHaveBeenCalledWith(
      'score_job',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it('returns JSON result on success', async () => {
    const server = createMockServer();
    const client = {
      scoreJob: vi.fn().mockResolvedValue(mockScoreJobResult),
    };
    registerScoreJob(server as never, client as never);
    const handler = server.getHandler('score_job');
    const result = await handler({
      url: 'https://example.com/jobs/senior-engineer',
      title: 'Senior Software Engineer',
      company: 'Acme Corp',
    });

    expect(result.isError).toBeUndefined();
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.company).toBe('Acme Corp');
    expect(parsed.title).toBe('Senior Software Engineer');
    expect(parsed.recommendation).toBe('marginal_improvement');
  });

  it('calls client.scoreJob with correct arguments', async () => {
    const server = createMockServer();
    const client = {
      scoreJob: vi.fn().mockResolvedValue(mockScoreJobResult),
    };
    registerScoreJob(server as never, client as never);
    const handler = server.getHandler('score_job');
    await handler({
      url: 'https://jobs.example.com/123',
      title: 'Staff Engineer',
      company: 'BigTech',
    });

    expect(client.scoreJob).toHaveBeenCalledWith(
      'https://jobs.example.com/123',
      'Staff Engineer',
      'BigTech'
    );
  });

  it('returns isError true on failure', async () => {
    const server = createMockServer();
    const client = {
      scoreJob: vi.fn().mockRejectedValue(new Error('Network error')),
    };
    registerScoreJob(server as never, client as never);
    const handler = server.getHandler('score_job');
    const result = await handler({
      url: 'https://example.com/jobs/1',
      title: 'Engineer',
      company: 'Corp',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: Network error');
  });

  it('handles non-Error thrown values', async () => {
    const server = createMockServer();
    const client = {
      scoreJob: vi.fn().mockRejectedValue('string error'),
    };
    registerScoreJob(server as never, client as never);
    const handler = server.getHandler('score_job');
    const result = await handler({
      url: 'https://example.com/jobs/1',
      title: 'Engineer',
      company: 'Corp',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Error: string error');
  });

  it('rejects blank and whitespace-only title and company via schema validation', () => {
    const server = createMockServer();
    const client = { scoreJob: vi.fn() } as never;
    registerScoreJob(server as never, client);

    // Extract the Zod schema from the tool registration call
    const [,, schema] = (server.tool as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string, string, Record<string, z.ZodTypeAny>, unknown
    ];
    const validator = z.object(schema);

    const blankTitle = validator.safeParse({ url: 'https://example.com', title: '   ', company: 'Corp' });
    expect(blankTitle.success).toBe(false);

    const blankCompany = validator.safeParse({ url: 'https://example.com', title: 'Engineer', company: '   ' });
    expect(blankCompany.success).toBe(false);
  });
});
