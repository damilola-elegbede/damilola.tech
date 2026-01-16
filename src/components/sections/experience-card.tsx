'use client';

import { useState } from 'react';
import type { Experience } from '@/types';
import { cn } from '@/lib/utils';

interface ExperienceCardProps {
  experience: Experience;
}

export function ExperienceCard({ experience }: ExperienceCardProps) {
  const [isAiContextOpen, setIsAiContextOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-[var(--color-text)]">
          {experience.company}
        </h3>
        <p className="text-lg font-medium text-[var(--color-accent)]">
          {experience.title}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {experience.startDate} - {experience.endDate} • {experience.location}
        </p>
      </div>

      {/* Highlights */}
      <ul className="space-y-3">
        {experience.highlights.map((highlight, i) => (
          <li key={i} className="flex items-start text-[var(--color-text)]">
            <span className="mr-3 mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--color-accent)]" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>

      {/* AI Context Toggle */}
      <button
        onClick={() => setIsAiContextOpen(!isAiContextOpen)}
        className="mt-6 flex items-center gap-2 text-sm text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-accent)]"
        aria-expanded={isAiContextOpen}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded bg-[var(--color-bg-alt)]">
          🤖
        </span>
        <span>AI Context</span>
        <svg
          className={cn(
            'h-4 w-4 transition-transform',
            isAiContextOpen && 'rotate-180'
          )}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* AI Context Content */}
      {isAiContextOpen && (
        <div className="mt-4 rounded-lg bg-[var(--color-bg-alt)] p-4 text-sm text-[var(--color-text-muted)]">
          <p>
            Ask the AI chatbot for deeper insights about this role, including
            specific projects, challenges overcome, technologies used, and
            impact metrics. The AI has access to detailed STAR stories and
            context not shown here.
          </p>
        </div>
      )}
    </div>
  );
}
