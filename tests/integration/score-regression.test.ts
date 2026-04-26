/**
 * @vitest-environment node
 *
 * score_job regression harness.
 *
 * Scaffolding phase: validates that pre-fetched HTML fixtures load, extract
 * meaningful content, and match the shape the score_job endpoint expects.
 * The actual end-to-end scoring call is gated behind DAMILOLA_SCORE_API_KEY
 * and RUN_SCORE_REGRESSION=1, which lets CI skip it until the key + PR#119
 * (pre-fetched content refactor) land in production.
 *
 * Fixtures live at tests/fixtures/jobs/ and cover the three ATS HTML shapes
 * that score_job fetches most often (Greenhouse, Lever, Ashby).
 *
 * Run: npx vitest run tests/integration/score-regression.test.ts
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { detectEmptyShell, extractTextFromHtml } from '@/lib/job-description-input';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'jobs');

interface JobFixture {
  readonly file: string;
  readonly ats: 'greenhouse' | 'lever' | 'ashby' | 'ashby-shell' | 'workday-shell' | 'spa-shell';
  readonly title: string;
  readonly company: string;
  readonly url: string;
  readonly emptyShell: boolean;
  readonly html: string;
  readonly text: string;
}

const FIXTURE_MANIFEST: Array<Omit<JobFixture, 'html' | 'text'>> = [
  {
    file: 'greenhouse-staff-backend.html',
    ats: 'greenhouse',
    title: 'Staff Backend Engineer, Distributed Systems',
    company: 'ExampleCo',
    url: 'https://boards.greenhouse.io/exampleco/jobs/staff-backend',
    emptyShell: false,
  },
  {
    file: 'lever-senior-platform.html',
    ats: 'lever',
    title: 'Senior Platform Engineer',
    company: 'ExampleCo',
    url: 'https://jobs.lever.co/exampleco/senior-platform',
    emptyShell: false,
  },
  {
    file: 'ashby-principal-infra.html',
    ats: 'ashby',
    title: 'Principal Infrastructure Engineer',
    company: 'ExampleCo',
    url: 'https://jobs.ashbyhq.com/exampleco/principal-infra',
    emptyShell: false,
  },
  {
    file: 'ashby-empty-shell.html',
    ats: 'ashby-shell',
    title: 'Staff Platform Engineer',
    company: 'ShellCo',
    url: 'https://jobs.ashbyhq.com/shellco/staff-platform',
    emptyShell: true,
  },
  {
    file: 'workday-empty-shell.html',
    ats: 'workday-shell',
    title: 'Senior Engineering Manager',
    company: 'ShellCo',
    url: 'https://shellco.wd1.myworkdayjobs.com/en-US/ShellCo/job/Remote/Senior-Engineering-Manager_R-12345',
    emptyShell: true,
  },
  {
    file: 'spa-native-empty-shell.html',
    ats: 'spa-shell',
    title: 'Principal Software Engineer',
    company: 'ShellCo',
    url: 'https://careers.shellco.example/jobs/principal-software-engineer',
    emptyShell: true,
  },
];

const SSR_FIXTURES = FIXTURE_MANIFEST.filter((f) => !f.emptyShell);
const EMPTY_SHELL_FIXTURES = FIXTURE_MANIFEST.filter((f) => f.emptyShell);

function loadFixture(entry: Omit<JobFixture, 'html' | 'text'>): JobFixture {
  const absPath = path.join(FIXTURES_DIR, entry.file);
  const html = fs.readFileSync(absPath, 'utf8');
  const text = extractTextFromHtml(html);
  return { ...entry, html, text };
}

const scoreSchema = {
  requiredKeys: ['total', 'breakdown', 'reasoning'] as const,
  breakdownKeys: [
    'roleRelevance',
    'claritySkimmability',
    'businessImpact',
    'presentationQuality',
  ] as const,
};

type ScoreResponse = {
  total: number;
  breakdown: Record<(typeof scoreSchema.breakdownKeys)[number], number>;
  reasoning: string;
};

function assertScoreShape(payload: unknown): asserts payload is ScoreResponse {
  expect(payload).toBeTypeOf('object');
  expect(payload).not.toBeNull();
  const p = payload as Record<string, unknown>;
  for (const key of scoreSchema.requiredKeys) {
    expect(p, `missing key ${key}`).toHaveProperty(key);
  }
  expect(typeof p.total).toBe('number');
  expect(typeof p.reasoning).toBe('string');
  expect((p.reasoning as string).length).toBeGreaterThan(0);
  expect(p.breakdown).toBeTypeOf('object');
  const bd = p.breakdown as Record<string, unknown>;
  for (const key of scoreSchema.breakdownKeys) {
    expect(bd, `missing breakdown.${key}`).toHaveProperty(key);
    expect(typeof bd[key]).toBe('number');
  }
}

describe('score_job regression harness — fixture loading', () => {
  const fixtures: JobFixture[] = [];

  beforeAll(() => {
    for (const entry of FIXTURE_MANIFEST) {
      fixtures.push(loadFixture(entry));
    }
  });

  it('loads all SSR + empty-shell fixtures', () => {
    expect(fixtures).toHaveLength(FIXTURE_MANIFEST.length);
    const seen = new Set(fixtures.map((f) => f.ats));
    expect(seen).toEqual(
      new Set([
        'greenhouse',
        'lever',
        'ashby',
        'ashby-shell',
        'workday-shell',
        'spa-shell',
      ])
    );
  });

  it.each(SSR_FIXTURES)('$ats fixture extracts ≥100 chars of text', (entry) => {
    const f = fixtures.find((x) => x.file === entry.file);
    expect(f, `missing ${entry.file}`).toBeDefined();
    expect(f!.text.length).toBeGreaterThanOrEqual(100);
  });

  it.each(SSR_FIXTURES)('$ats fixture reads as a job description', (entry) => {
    const f = fixtures.find((x) => x.file === entry.file);
    const lower = f!.text.toLowerCase();
    const jdMarkers = [
      'responsibilities',
      'requirements',
      'experience',
      'engineer',
      'team',
    ];
    const hits = jdMarkers.filter((m) => lower.includes(m));
    expect(hits.length, `text: ${f!.text.slice(0, 200)}`).toBeGreaterThanOrEqual(2);
  });

  it.each(EMPTY_SHELL_FIXTURES)(
    '$ats fixture is classified as an empty SSR shell',
    (entry) => {
      const f = fixtures.find((x) => x.file === entry.file);
      expect(f, `missing ${entry.file}`).toBeDefined();
      expect(detectEmptyShell(f!.html)).toBe(true);
    }
  );
});

const shouldRunE2e =
  process.env.RUN_SCORE_REGRESSION === '1' && !!process.env.DAMILOLA_SCORE_API_KEY;

describe.skipIf(!shouldRunE2e)('score_job regression harness — live scoring', () => {
  const endpoint =
    process.env.SCORE_JOB_ENDPOINT ??
    'https://damilola.tech/api/v1/score-job';
  const fixtures: JobFixture[] = [];

  beforeAll(() => {
    for (const entry of FIXTURE_MANIFEST) {
      fixtures.push(loadFixture(entry));
    }
  });

  async function callScoreJob(fixture: JobFixture): Promise<ScoreResponse> {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.DAMILOLA_SCORE_API_KEY!,
      },
      body: JSON.stringify({
        url: fixture.url,
        title: fixture.title,
        company: fixture.company,
        content: fixture.html,
      }),
    });
    expect(res.ok, `score_job non-2xx: ${res.status}`).toBe(true);
    const body = (await res.json()) as { data?: unknown };
    assertScoreShape(body.data);
    return body.data as ScoreResponse;
  }

  it.each(FIXTURE_MANIFEST)(
    '$ats fixture returns a valid score payload',
    async (entry) => {
      const fixture = fixtures.find((f) => f.file === entry.file)!;
      const scored = await callScoreJob(fixture);
      expect(scored.total).toBeGreaterThanOrEqual(0);
      expect(scored.total).toBeLessThanOrEqual(100);
    },
    30_000
  );

  it.each(FIXTURE_MANIFEST)(
    '$ats fixture is stable within ±5 on a second run',
    async (entry) => {
      const fixture = fixtures.find((f) => f.file === entry.file)!;
      const first = await callScoreJob(fixture);
      const second = await callScoreJob(fixture);
      expect(Math.abs(first.total - second.total)).toBeLessThanOrEqual(5);
    },
    60_000
  );
});
