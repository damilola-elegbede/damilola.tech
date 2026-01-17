'use client';

import { resumeData } from '@/lib/resume-data';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { cn } from '@/lib/utils';

interface SkillCardProps {
  title: string;
  items: string[];
  variant: 'strong' | 'moderate' | 'gaps';
}

function SkillCard({ title, items, variant }: SkillCardProps) {
  const variantStyles = {
    strong: {
      border: 'border-[var(--color-accent-green)]',
      bg: 'bg-[var(--color-card-strong)]',
      hoverBorder: 'hover:border-[var(--color-accent-green)]',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(34,197,94,0.2)]',
      icon: (
        <svg
          aria-hidden="true"
          focusable="false"
          className="h-5 w-5 text-[var(--color-accent-green)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
      ),
      titleColor: 'text-[var(--color-accent-green)]',
    },
    moderate: {
      border: 'border-[var(--color-accent-mustard)]',
      bg: 'bg-[var(--color-card-moderate)]',
      hoverBorder: 'hover:border-[var(--color-accent-mustard)]',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(234,179,8,0.2)]',
      icon: (
        <svg
          aria-hidden="true"
          focusable="false"
          className="h-5 w-5 text-[var(--color-accent-mustard)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="3" strokeWidth={2} />
        </svg>
      ),
      titleColor: 'text-[var(--color-accent-mustard)]',
    },
    gaps: {
      border: 'border-[var(--color-accent-red)]',
      bg: 'bg-[var(--color-card-gaps)]',
      hoverBorder: 'hover:border-[var(--color-accent-red)]',
      hoverShadow: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]',
      icon: (
        <svg
          aria-hidden="true"
          focusable="false"
          className="h-5 w-5 text-[var(--color-accent-red)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      ),
      titleColor: 'text-[var(--color-accent-red)]',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={cn(
        'rounded-lg border-2 p-6 transition-all duration-200',
        styles.border,
        styles.bg,
        styles.hoverBorder,
        styles.hoverShadow
      )}
    >
      <h3 className={`mb-4 text-lg font-semibold ${styles.titleColor}`}>
        {title}
      </h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-3 text-[var(--color-text)]">
            {styles.icon}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkillsAssessment() {
  const { skillsAssessment } = resumeData;
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="skills-assessment"
      ref={ref as React.RefObject<HTMLElement>}
      className={cn(
        'bg-[var(--color-bg-alt)] px-6 py-20 transition-all duration-700 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      )}
    >
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-3xl text-[var(--color-text)] md:text-4xl">
          Skills Assessment
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          <SkillCard
            title="Strong"
            items={skillsAssessment.strong}
            variant="strong"
          />
          <SkillCard
            title="Moderate"
            items={skillsAssessment.moderate}
            variant="moderate"
          />
          <SkillCard
            title="Gaps"
            items={skillsAssessment.gaps}
            variant="gaps"
          />
        </div>
      </div>
    </section>
  );
}
