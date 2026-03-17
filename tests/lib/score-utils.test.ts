import { describe, expect, it } from 'vitest';
import { computeCappedScore, computePossibleMaxScore, sanitizeBreakdown, sanitizeScoreValue } from '@/lib/score-utils';
import type { ProposedChange } from '@/lib/types/resume-generation';

describe('score-utils', () => {
  it('sanitizes invalid scalar score values', () => {
    expect(sanitizeScoreValue(Number.NaN, 0, 100)).toBe(0);
    expect(sanitizeScoreValue(Number.POSITIVE_INFINITY, 0, 100)).toBe(0);
    expect(sanitizeScoreValue(-12, 0, 100)).toBe(0);
    expect(sanitizeScoreValue(120, 0, 100)).toBe(100);
  });

  it('sanitizes breakdown values within category limits', () => {
    const sanitized = sanitizeBreakdown({
      roleRelevance: 70,
      claritySkimmability: Number.NaN,
      businessImpact: -4,
      presentationQuality: 20,
    });

    expect(sanitized).toEqual({
      roleRelevance: 30,
      claritySkimmability: 0,
      businessImpact: 0,
      presentationQuality: 15,
    });
  });

  it('computes capped score with score ceiling', () => {
    const result = computeCappedScore(47.6, 50, {
      maximum: 78,
      blockers: [],
      toImprove: '',
    });
    expect(result).toBe(78);
  });

  it('returns integer scores (no fractional values)', () => {
    expect(sanitizeScoreValue(47.6, 0, 100)).toBe(48);
    expect(sanitizeScoreValue(3.3, 0, 30)).toBe(3);
    expect(computeCappedScore(48, 10, undefined)).toBe(58);
  });

  it('computes possible max score from all proposed impacts', () => {
    const changes: ProposedChange[] = [
      { section: 'summary', original: 'a', modified: 'b', reason: '', relevanceSignals: [], impactPoints: 4 },
      { section: 'skills.core', original: 'c', modified: 'd', reason: '', relevanceSignals: [], impactPoints: 6 },
    ];

    const result = computePossibleMaxScore(60, changes, undefined);
    expect(result).toBe(70);
  });
});
