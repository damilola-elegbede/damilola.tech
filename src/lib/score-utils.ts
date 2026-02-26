import type { ProposedChange, ScoreBreakdown, ScoreCeiling } from '@/lib/types/resume-generation';

export function sanitizeScoreValue(value: unknown, min: number, max: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) {
    return min;
  }
  return Math.max(min, Math.min(max, numeric));
}

export function sanitizeBreakdown(breakdown: ScoreBreakdown): ScoreBreakdown {
  return {
    keywordRelevance: sanitizeScoreValue(breakdown.keywordRelevance, 0, 45),
    skillsQuality: sanitizeScoreValue(breakdown.skillsQuality, 0, 25),
    experienceAlignment: sanitizeScoreValue(breakdown.experienceAlignment, 0, 20),
    contentQuality: sanitizeScoreValue(breakdown.contentQuality, 0, 10),
  };
}

export function computeCappedScore(
  currentScore: number,
  delta: number,
  scoreCeiling?: ScoreCeiling
): number {
  const base = sanitizeScoreValue(currentScore, 0, 100);
  const increment = sanitizeScoreValue(delta, 0, 100);
  const ceiling = sanitizeScoreValue(scoreCeiling?.maximum ?? 100, 0, 100);
  return Math.round(Math.min(ceiling, base + increment) * 10) / 10;
}

export function computePossibleMaxScore(
  currentScore: number,
  proposedChanges: ProposedChange[],
  scoreCeiling?: ScoreCeiling
): number {
  const totalDelta = proposedChanges.reduce(
    (sum, change) => sum + sanitizeScoreValue(change.impactPoints, 0, 100),
    0
  );
  return computeCappedScore(currentScore, totalDelta, scoreCeiling);
}
