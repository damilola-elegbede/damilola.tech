import { resumeData } from '@/lib/resume-data';

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
      icon: (
        <svg
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
      border: 'border-[var(--color-text-muted)]',
      bg: 'bg-[var(--color-card-moderate)]',
      icon: (
        <svg
          className="h-5 w-5 text-[var(--color-text-muted)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <circle cx="12" cy="12" r="3" strokeWidth={2} />
        </svg>
      ),
      titleColor: 'text-[var(--color-text-muted)]',
    },
    gaps: {
      border: 'border-[var(--color-accent-amber)]',
      bg: 'bg-[var(--color-card-gaps)]',
      icon: (
        <svg
          className="h-5 w-5 text-[var(--color-accent-amber)]"
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
      titleColor: 'text-[var(--color-accent-amber)]',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      className={`rounded-lg border-2 ${styles.border} ${styles.bg} p-6`}
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

  return (
    <section id="skills-assessment" className="bg-[var(--color-bg-alt)] px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-[var(--color-text)]">
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
