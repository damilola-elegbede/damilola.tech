import type { ProposedChange, ResumeAnalysisResult, ImpactBreakdown } from '@/lib/types/resume-generation';

function keywordInText(text: string, keyword: string): boolean {
  const normalizedText = text.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase().trim();
  if (!normalizedKeyword) return false;

  // For single-token keywords, use non-word lookarounds to support tokens like C++ and .NET.
  if (!normalizedKeyword.includes(' ')) {
    const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<!\\w)${escaped}(?!\\w)`, 'i').test(normalizedText);
  }

  // For multi-word phrases, allow flexible whitespace and punctuation boundaries.
  const phrasePattern = normalizedKeyword
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\-/,._+]+');
  return new RegExp(`(?<!\\w)${phrasePattern}(?!\\w)`, 'i').test(normalizedText);
}

/**
 * Calculate the adjusted impact when a user edits a proposed change.
 * Uses impactPerKeyword if available, otherwise falls back to proportional calculation.
 * When impactBreakdown is present, scales each category by signal retention ratio.
 * @param change - The original proposed change
 * @param editedText - The user's edited version of the text
 * @returns The adjusted impact points based on retained keywords
 */
export function calculateEditedImpact(change: ProposedChange, editedText: string): number {
  if (change.relevanceSignals.length === 0) {
    return change.impactPoints;
  }

  // Count how many signals are retained in the edited text
  const retainedSignals = change.relevanceSignals.filter((signal) =>
    keywordInText(editedText, signal)
  );

  // Use impactPerSignal if available, otherwise calculate from impactPoints
  const impactPerSignal = change.impactPerSignal
    ?? change.impactPoints / change.relevanceSignals.length;

  return Math.round(retainedSignals.length * impactPerSignal);
}

/**
 * Calculate the adjusted impact breakdown when a user edits a proposed change.
 * Scales each category by the signal retention ratio and rounds to integers.
 * Returns undefined if the change has no impactBreakdown.
 */
export function calculateEditedImpactBreakdown(
  change: ProposedChange,
  editedText: string
): ImpactBreakdown | undefined {
  if (!change.impactBreakdown) return undefined;
  if (change.relevanceSignals.length === 0) return change.impactBreakdown;

  const retainedCount = change.relevanceSignals.filter((signal) =>
    keywordInText(editedText, signal)
  ).length;
  const ratio = retainedCount / change.relevanceSignals.length;

  return {
    roleRelevance: Math.round(change.impactBreakdown.roleRelevance * ratio),
    claritySkimmability: Math.round(change.impactBreakdown.claritySkimmability * ratio),
    businessImpact: Math.round(change.impactBreakdown.businessImpact * ratio),
    presentationQuality: Math.round(change.impactBreakdown.presentationQuality * ratio),
  };
}

/**
 * Proportionally scale each change's impactPoints (and impactPerSignal) so their
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
  // Uses floor to avoid overshoot; remainder is distributed to the largest change.
  const scaledChanges = result.proposedChanges.map((change) => {
    const scaledImpact = Math.floor(change.impactPoints * scaleFactor);
    const scaledPerSignal = change.impactPerSignal !== undefined
      ? Math.round(change.impactPerSignal * scaleFactor)
      : undefined;
    const scaledBreakdown = change.impactBreakdown
      ? {
          roleRelevance: Math.round(change.impactBreakdown.roleRelevance * scaleFactor),
          claritySkimmability: Math.round(change.impactBreakdown.claritySkimmability * scaleFactor),
          businessImpact: Math.round(change.impactBreakdown.businessImpact * scaleFactor),
          presentationQuality: Math.round(change.impactBreakdown.presentationQuality * scaleFactor),
        }
      : undefined;
    return {
      ...change,
      impactPoints: scaledImpact,
      ...(scaledPerSignal !== undefined ? { impactPerSignal: scaledPerSignal } : {}),
      ...(scaledBreakdown !== undefined ? { impactBreakdown: scaledBreakdown } : {}),
    };
  });

  // Distribute any remaining budget due to floor rounding to the largest change
  const scaledSum = scaledChanges.reduce((sum, c) => sum + c.impactPoints, 0);
  const remainder = budget - scaledSum;
  if (remainder > 0 && scaledChanges.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < scaledChanges.length; i++) {
      if (result.proposedChanges[i].impactPoints > result.proposedChanges[maxIdx].impactPoints) {
        maxIdx = i;
      }
    }
    scaledChanges[maxIdx] = {
      ...scaledChanges[maxIdx],
      impactPoints: scaledChanges[maxIdx].impactPoints + remainder,
    };
  }

  return { ...result, proposedChanges: scaledChanges };
}
