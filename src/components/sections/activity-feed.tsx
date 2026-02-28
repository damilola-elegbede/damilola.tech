"use client";

import { useEffect, useState } from "react";
import type { ActivitySummary } from "@/lib/types/activity-summary";
import { Badge } from "@/components/ui";

function formatWeekEnding(dateStr: string): string {
  const date = new Date(dateStr);
  return `Week of ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

function SkeletonItem() {
  return (
    <div className="animate-pulse space-y-2 rounded-md border border-[var(--color-border)] p-3">
      <div className="h-3 w-1/3 rounded bg-[var(--color-border)]" />
      <div className="h-4 w-3/4 rounded bg-[var(--color-border)]" />
      <div className="h-3 w-1/2 rounded bg-[var(--color-border)]" />
    </div>
  );
}

interface ActivityItemProps {
  summary: ActivitySummary;
}

function ActivityItem({ summary }: ActivityItemProps) {
  return (
    <div className="animate-[fadeIn_0.4s_ease-in-out] rounded-md border border-[var(--color-border)] bg-transparent p-3 space-y-2">
      <p className="text-xs text-[var(--color-text-muted)]">
        {formatWeekEnding(summary.weekEnding)}
      </p>
      <p className="text-sm font-medium text-[var(--color-text)]">
        {summary.headline}
      </p>
      <ul className="space-y-1">
        {summary.highlights.map((h, i) => (
          <li
            key={i}
            className="flex items-start text-xs text-[var(--color-text-muted)]"
          >
            <span className="mr-2 mt-0.5 flex-shrink-0 text-[var(--color-accent)]">
              ›
            </span>
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-[var(--color-text-muted)]">
        {summary.metrics.prsShipped} PRs · {summary.metrics.featuresDelivered}{" "}
        features
      </p>
      {summary.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {summary.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="px-2 py-0.5 text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function ActivityFeed() {
  const [summaries, setSummaries] = useState<ActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((json) => {
        setSummaries(Array.isArray(json?.data) ? json.data : []);
      })
      .catch(() => {
        setSummaries([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3" aria-label="Loading activity">
        <SkeletonItem />
        <SkeletonItem />
      </div>
    );
  }

  if (summaries.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-muted)]">
        No activity data yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {summaries.map((summary) => (
        <ActivityItem key={summary.id} summary={summary} />
      ))}
    </div>
  );
}
