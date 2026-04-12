/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import {
  buildScorePayload,
  buildGapAnalysisPrompt,
  extractTextContent,
  parseJsonResponse,
  buildScoringInput,
} from '@/lib/score-core';
import type { ReadinessScore } from '@/lib/readiness-scorer';

function makeReadinessScore(overrides: Partial<ReadinessScore> = {}): ReadinessScore {
  return {
    total: 72,
    breakdown: {
      roleRelevance: 20,
      claritySkimmability: 22,
      businessImpact: 18,
      presentationQuality: 12,
    },
    isOptimized: true,
    details: {
      matchedKeywords: ['typescript', 'react', 'node'],
      missingKeywords: ['kubernetes', 'go'],
      keywordDensity: 4.5,
      matchRate: 60,
      extractedKeywords: {
        all: [],
        fromTitle: [],
        fromRequired: [],
        fromNiceToHave: [],
        technologies: [],
        actionVerbs: [],
        keywordPriorities: {},
        keywordFrequency: {},
      },
      matchDetails: [],
    },
    ...overrides,
  };
}

describe('buildScorePayload', () => {
  it('returns total, breakdown, keywords, and rates', () => {
    const score = makeReadinessScore();
    const payload = buildScorePayload(score);

    expect(payload.total).toBe(72);
    expect(payload.breakdown).toEqual({
      roleRelevance: 20,
      claritySkimmability: 22,
      businessImpact: 18,
      presentationQuality: 12,
    });
    expect(payload.matchedKeywords).toEqual(['typescript', 'react', 'node']);
    expect(payload.missingKeywords).toEqual(['kubernetes', 'go']);
    expect(payload.matchRate).toBe(60);
    expect(payload.keywordDensity).toBe(4.5);
  });

  it('sanitizes breakdown values to category limits', () => {
    const score = makeReadinessScore({
      breakdown: {
        roleRelevance: 999,
        claritySkimmability: -1,
        businessImpact: 0,
        presentationQuality: 15,
      },
    });
    const payload = buildScorePayload(score);
    expect(payload.breakdown.roleRelevance).toBe(30);
    expect(payload.breakdown.claritySkimmability).toBe(0);
  });
});

describe('buildGapAnalysisPrompt', () => {
  it('includes the current score total in the prompt', () => {
    const payload = buildScorePayload(makeReadinessScore());
    const prompt = buildGapAnalysisPrompt(payload);

    expect(prompt).toContain('72/100');
  });

  it('includes matched and missing keywords', () => {
    const payload = buildScorePayload(makeReadinessScore());
    const prompt = buildGapAnalysisPrompt(payload);

    expect(prompt).toContain('typescript');
    expect(prompt).toContain('kubernetes');
  });

  it('returns a string containing the expected JSON schema', () => {
    const payload = buildScorePayload(makeReadinessScore());
    const prompt = buildGapAnalysisPrompt(payload);

    expect(prompt).toContain('"gapAnalysis"');
    expect(prompt).toContain('"maxPossibleScore"');
    expect(prompt).toContain('"recommendation"');
  });

  it('handles empty keyword arrays gracefully', () => {
    const score = makeReadinessScore({
      details: {
        matchedKeywords: [],
        missingKeywords: [],
        keywordDensity: 0,
        matchRate: 0,
        extractedKeywords: {
          all: [],
          fromTitle: [],
          fromRequired: [],
          fromNiceToHave: [],
          technologies: [],
          actionVerbs: [],
          keywordPriorities: {},
          keywordFrequency: {},
        },
        matchDetails: [],
      },
    });
    const payload = buildScorePayload(score);
    const prompt = buildGapAnalysisPrompt(payload);

    expect(prompt).toContain('none');
  });
});

describe('extractTextContent', () => {
  it('extracts text from a text block', () => {
    const content = [
      { type: 'text', text: 'hello world' },
    ];
    expect(extractTextContent(content)).toBe('hello world');
  });

  it('returns empty string when no text block found', () => {
    const content = [{ type: 'tool_use' }];
    expect(extractTextContent(content)).toBe('');
  });

  it('returns empty string for empty array', () => {
    expect(extractTextContent([])).toBe('');
  });

  it('returns the first text block when multiple blocks exist', () => {
    const content = [
      { type: 'thinking', text: 'reasoning...' },
      { type: 'text', text: 'actual answer' },
    ];
    expect(extractTextContent(content)).toBe('actual answer');
  });
});

describe('parseJsonResponse', () => {
  it('parses plain JSON', () => {
    const json = '{"gapAnalysis":"good","maxPossibleScore":85,"recommendation":"strong_fit"}';
    const result = parseJsonResponse(json);
    expect(result.gapAnalysis).toBe('good');
    expect(result.maxPossibleScore).toBe(85);
    expect(result.recommendation).toBe('strong_fit');
  });

  it('strips markdown json fence', () => {
    const json = '```json\n{"gapAnalysis":"ok","maxPossibleScore":80,"recommendation":"marginal_improvement"}\n```';
    const result = parseJsonResponse(json);
    expect(result.gapAnalysis).toBe('ok');
  });

  it('strips plain markdown fence', () => {
    const json = '```\n{"gapAnalysis":"ok","maxPossibleScore":75,"recommendation":"full_generation_recommended"}\n```';
    const result = parseJsonResponse(json);
    expect(result.maxPossibleScore).toBe(75);
  });

  it('extracts JSON from surrounding text', () => {
    const json = 'Here is the result: {"gapAnalysis":"found","maxPossibleScore":70,"recommendation":"strong_fit"} done.';
    const result = parseJsonResponse(json);
    expect(result.gapAnalysis).toBe('found');
  });

  it('throws on completely invalid JSON', () => {
    expect(() => parseJsonResponse('not json at all')).toThrow();
  });
});

describe('buildScoringInput', () => {
  it('returns a readinessScore with a total between 0 and 100', () => {
    const jd = 'Senior TypeScript engineer with React and Node.js experience.';
    const { readinessScore } = buildScoringInput(jd);

    expect(readinessScore.total).toBeGreaterThanOrEqual(0);
    expect(readinessScore.total).toBeLessThanOrEqual(100);
  });

  it('returns score with expected shape', () => {
    const jd = 'Staff engineer with distributed systems experience';
    const { readinessScore } = buildScoringInput(jd);

    expect(readinessScore).toHaveProperty('breakdown');
    expect(readinessScore).toHaveProperty('details.matchedKeywords');
    expect(readinessScore).toHaveProperty('details.missingKeywords');
    expect(readinessScore).toHaveProperty('details.matchRate');
  });
});
