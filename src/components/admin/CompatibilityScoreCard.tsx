'use client';

import type { ScoreBreakdown } from '@/lib/types/resume-generation';
import { sanitizeBreakdown, sanitizeScoreValue } from '@/lib/score-utils';

interface CompatibilityScoreCardProps {
  title: string;
  score: number;
  breakdown: ScoreBreakdown;
  assessment: string;
  highlight?: boolean;
  targetScore?: number;
}

function getScoreColor(score: number): string {
  if (score >= 85) return 'text-green-400';
  if (score >= 70) return 'text-blue-400';
  if (score >= 55) return 'text-yellow-400';
  return 'text-red-400';
}

function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  return 'Weak';
}

function ScoreBar({
  label,
  value,
  maxValue,
  description,
}: {
  label: string;
  value: number;
  maxValue: number;
  description: string;
}) {
  const safeValue = sanitizeScoreValue(value, 0, maxValue);
  const percentage = (safeValue / maxValue) * 100;
  const barColor =
    percentage >= 75 ? 'bg-green-500' : percentage >= 50 ? 'bg-blue-500' : percentage >= 25 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-[var(--color-text-muted)]" title={description}>
          {label}
        </span>
        <span className="text-[var(--color-text)]">
          {Math.round(safeValue * 10) / 10}/{maxValue}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-bg-alt)]">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function CompatibilityScoreCard({
  title,
  score,
  breakdown,
  assessment,
  highlight,
  targetScore,
}: CompatibilityScoreCardProps) {
  const safeScore = sanitizeScoreValue(score, 0, 100);
  const safeTargetScore = targetScore === undefined ? undefined : sanitizeScoreValue(targetScore, 0, 100);
  const safeBreakdown = sanitizeBreakdown(breakdown);
  const showTarget = safeTargetScore !== undefined && safeTargetScore > safeScore;
  return (
    <div className={`rounded-lg border bg-[var(--color-card)] p-6 ${highlight ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/30' : 'border-[var(--color-border)]'}`}>
      <h3 className="text-sm font-medium text-[var(--color-text-muted)]">{title}</h3>

      <div className="mt-4 flex items-baseline gap-2">
        <span className={`text-4xl font-bold ${getScoreColor(safeScore)}`}>{Math.round(safeScore * 10) / 10}</span>
        {showTarget && (
          <>
            <span className="text-2xl text-[var(--color-text-muted)]">→</span>
            <span className={`text-2xl font-medium ${getScoreColor(safeTargetScore)}`}>{Math.round(safeTargetScore * 10) / 10}</span>
          </>
        )}
        <span
          className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
            safeScore >= 85
              ? 'bg-green-500/20 text-green-400'
              : safeScore >= 70
                ? 'bg-blue-500/20 text-blue-400'
                : safeScore >= 55
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
          }`}
        >
          {getScoreLabel(safeScore)}
        </span>
        {safeTargetScore !== undefined && (
          <span className="text-xs text-[var(--color-text-muted)]">
            (of {Math.round(safeTargetScore * 10) / 10})
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-[var(--color-text-muted)]">{assessment}</p>

      <div className="mt-6 space-y-3">
        <ScoreBar
          label="Role Relevance"
          value={safeBreakdown.roleRelevance}
          maxValue={30}
          description="JD keywords and title alignment (30 pts max)"
        />
        <ScoreBar
          label="Clarity & Skimmability"
          value={safeBreakdown.claritySkimmability}
          maxValue={30}
          description="Structure, conciseness, and frontloading (30 pts max)"
        />
        <ScoreBar
          label="Business Impact"
          value={safeBreakdown.businessImpact}
          maxValue={25}
          description="Quantified outcomes and achievement framing (25 pts max)"
        />
        <ScoreBar
          label="Presentation Quality"
          value={safeBreakdown.presentationQuality}
          maxValue={15}
          description="Natural keyword use, title bridging, and professional format (15 pts max)"
        />
      </div>
    </div>
  );
}
