import { test, expect } from '@playwright/test';

const FIXTURE_JOB_POSTING = `
Infrastructure Engineer — Reliability Systems
Acme Cloud Platform

We are looking for an experienced Infrastructure Engineer to join our reliability engineering team. You will design, build, and operate the systems that power our platform serving 500M+ daily active users.

Responsibilities:
- Design and implement reliability patterns for distributed systems
- Own observability infrastructure including metrics, logging, and tracing
- Drive incident response and postmortem culture
- Collaborate with product engineers to define SLOs and error budgets

Qualifications:
- 8+ years experience in infrastructure or site reliability engineering
- Deep experience with Kubernetes, Terraform, and cloud platforms (AWS/GCP/Azure)
- Experience with distributed systems at scale (millions of requests per second)
- Strong programming skills in Go, Python, or TypeScript
- Track record of reducing MTTR and improving system reliability

Nice to have:
- Experience with Prometheus, Grafana, or equivalent observability stacks
- Knowledge of capacity planning and cost optimization at scale

Compensation: $250,000–$350,000 base + equity
Location: Remote-friendly (US timezones)
Apply at: careers.acme.example/reliability-engineer
`;

const API_KEY = process.env.DAMILOLA_TECH_API_KEY ?? process.env.DK_API_KEY ?? '';

/**
 * Helper to extract frontmatter from a cover letter markdown string.
 * Returns the parsed key-value pairs from the YAML block between --- markers.
 */
function parseFrontmatter(markdown: string): Record<string, string> {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    frontmatter[key] = value;
  }
  return frontmatter;
}

/**
 * Helper to count words in the letter body (excluding frontmatter).
 */
function countBodyWords(markdown: string): number {
  const stripped = markdown.replace(/^---[\s\S]*?---\n?/, '');
  return stripped.trim().split(/\s+/).filter(Boolean).length;
}

test.describe('POST /api/v1/generate-cover-letter', () => {
  test.skip(!API_KEY, 'Skipping: DAMILOLA_TECH_API_KEY or DK_API_KEY not set in environment');

  test('returns valid cover letter with frontmatter for text input', async ({ request }) => {
    const response = await request.post('/api/v1/generate-cover-letter', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      data: {
        job_posting_text: FIXTURE_JOB_POSTING,
        tone: 'confident',
        company: 'Acme Cloud Platform',
        role: 'Infrastructure Engineer',
      },
      timeout: 60000,
    });

    expect(response.ok()).toBe(true);

    const body = await response.json() as {
      success: boolean;
      data: {
        cover_letter_markdown: string;
        metadata: {
          company: string;
          role: string;
          generated_at: string;
          model: string;
          input_source: string;
          score_job_used: boolean;
          token_usage: { input: number; output: number; cache_read: number };
        };
      };
    };

    // Verify response shape matches §4 of design doc
    expect(body.success).toBe(true);
    expect(body.data.cover_letter_markdown).toBeTruthy();
    expect(body.data.metadata).toBeTruthy();
    expect(body.data.metadata.model).toBe('claude-sonnet-4-6');
    expect(body.data.metadata.input_source).toBe('text');
    expect(body.data.metadata.score_job_used).toBe(false);
    expect(typeof body.data.metadata.token_usage.input).toBe('number');
    expect(typeof body.data.metadata.token_usage.output).toBe('number');
    expect(typeof body.data.metadata.token_usage.cache_read).toBe('number');

    // Verify frontmatter structure
    const frontmatter = parseFrontmatter(body.data.cover_letter_markdown);
    expect(frontmatter.company).toBeTruthy();
    expect(frontmatter.role).toBeTruthy();
    expect(frontmatter.generated_at).toBeTruthy();
    expect(frontmatter.tone).toBe('confident');
    expect(frontmatter.score_job_fit).toBeTruthy(); // should be a string number

    // Verify word count constraint
    const wordCount = countBodyWords(body.data.cover_letter_markdown);
    expect(wordCount).toBeLessThanOrEqual(400);
    expect(wordCount).toBeGreaterThan(50); // sanity check: not empty
  });

  test('returns cache_read > 0 on the second call (proving prompt cache hit)', async ({ request }) => {
    const payload = {
      job_posting_text: FIXTURE_JOB_POSTING,
      tone: 'warm',
      company: 'Acme Cloud Platform',
      role: 'Infrastructure Engineer — Warm Tone',
    };

    const headers = {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    };

    // First call — may or may not hit cache depending on prior state
    const first = await request.post('/api/v1/generate-cover-letter', {
      headers,
      data: payload,
      timeout: 60000,
    });
    expect(first.ok()).toBe(true);
    const firstBody = await first.json() as {
      data: { metadata: { token_usage: { cache_read: number } } };
    };

    // Second call with the same system prompt — should hit the Anthropic prompt cache
    const second = await request.post('/api/v1/generate-cover-letter', {
      headers,
      data: payload,
      timeout: 60000,
    });
    expect(second.ok()).toBe(true);
    const secondBody = await second.json() as {
      data: { metadata: { token_usage: { cache_read: number } } };
    };

    // Assert cache hit on the second call
    // Note: first call may also have cache_read if the template was already cached by another request
    expect(secondBody.data.metadata.token_usage.cache_read).toBeGreaterThan(0);

    // The second call should read significantly more from cache than it creates (or equal)
    expect(secondBody.data.metadata.token_usage.cache_read).toBeGreaterThanOrEqual(
      firstBody.data.metadata.token_usage.cache_read
    );
  });
});
