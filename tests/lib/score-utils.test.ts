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
      keywordRelevance: 70,
      skillsQuality: Number.NaN,
      experienceAlignment: -4,
      contentQuality: 12,
    });

    expect(sanitized).toEqual({
      keywordRelevance: 45,
      skillsQuality: 0,
      experienceAlignment: 0,
      contentQuality: 10,
    });
  });

  it('computes capped score with score ceiling', () => {
    const result = computeCappedScore(47.6, 50, {
      maximum: 78,
      blockers: [],
      toReach90: '',
    });
    expect(result).toBe(78);
  });

  it('computes possible max score from all proposed impacts', () => {
    const changes: ProposedChange[] = [
      { section: 'summary', original: 'a', modified: 'b', reason: '', keywordsAdded: [], impactPoints: 4 },
      { section: 'skills.core', original: 'c', modified: 'd', reason: '', keywordsAdded: [], impactPoints: 6.2 },
    ];

    const result = computePossibleMaxScore(60, changes, undefined);
    expect(result).toBe(70.2);
  });
});
