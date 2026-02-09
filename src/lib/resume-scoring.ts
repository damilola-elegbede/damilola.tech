import type { ProposedChange, ResumeAnalysisResult } from '@/lib/types/resume-generation';

/**
 * Calculate the adjusted impact when a user edits a proposed change.
 * Uses impactPerKeyword if available, otherwise falls back to proportional calculation.
 * @param change - The original proposed change
 * @param editedText - The user's edited version of the text
 * @returns The adjusted impact points based on retained keywords
 */
export function calculateEditedImpact(change: ProposedChange, editedText: string): number {
  if (change.keywordsAdded.length === 0) {
    return change.impactPoints;
  }

  // Count how many keywords are retained in the edited text
  const editedLower = editedText.toLowerCase();
  const retainedKeywords = change.keywordsAdded.filter((keyword) =>
    editedLower.includes(keyword.toLowerCase())
  );

  // Use impactPerKeyword if available, otherwise calculate from impactPoints
  const impactPerKeyword = change.impactPerKeyword
    ?? change.impactPoints / change.keywordsAdded.length;

  return Math.round(retainedKeywords.length * impactPerKeyword);
}

/**
 * Proportionally scale each change's impactPoints (and impactPerKeyword) so their
 * sum equals the achievable score delta (budget). This prevents the projected score
 * from exceeding the score ceiling when Claude's per-change estimates are inflated.
 *
 * budget = min(scoreCeiling.maximum, optimizedScore.total) - currentScore.total
 * scaleFactor = rawSum > budget ? budget / rawSum : 1.0
 */
export function normalizeImpactPoints(
  result: ResumeAnalysisResult
): ResumeAnalysisResult {
  const rawSum = result.proposedChanges.reduce((sum, c) => sum + c.impactPoints, 0);
  const ceiling = result.scoreCeiling?.maximum ?? 100;
  const budget = Math.max(0, Math.min(ceiling, result.optimizedScore.total) - result.currentScore.total);

  if (budget === 0 && rawSum > 0) {
    console.warn(JSON.stringify({
      event: 'resume_generator.budget_exhausted',
      currentScore: result.currentScore.total,
      ceiling,
      optimizedScore: result.optimizedScore.total,
      message: 'Score already at or above ceiling; all impact points normalized to 0',
    }));
  }

  if (rawSum <= budget || rawSum === 0) {
    return result;
  }

  const scaleFactor = budget / rawSum;

  // Scale each change's impactPoints proportionally.
  // Uses floor to avoid overshoot; remainder is distributed via round to the largest change.
  const scaledChanges = result.proposedChanges.map((change) => {
    const scaledImpact = Math.floor(change.impactPoints * scaleFactor * 100) / 100;
    const scaledPerKeyword = change.impactPerKeyword !== undefined
      ? Math.floor(change.impactPerKeyword * scaleFactor * 100) / 100
      : undefined;
    return {
      ...change,
      impactPoints: scaledImpact,
      ...(scaledPerKeyword !== undefined ? { impactPerKeyword: scaledPerKeyword } : {}),
    };
  });

  // Distribute any remaining budget due to floor rounding to the largest change
  const scaledSum = scaledChanges.reduce((sum, c) => sum + c.impactPoints, 0);
  const remainder = Math.round((budget - scaledSum) * 100) / 100;
  if (remainder > 0 && scaledChanges.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < scaledChanges.length; i++) {
      if (result.proposedChanges[i].impactPoints > result.proposedChanges[maxIdx].impactPoints) {
        maxIdx = i;
      }
    }
    scaledChanges[maxIdx] = {
      ...scaledChanges[maxIdx],
      impactPoints: Math.round((scaledChanges[maxIdx].impactPoints + remainder) * 100) / 100,
    };
  }

  return { ...result, proposedChanges: scaledChanges };
}
