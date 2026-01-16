'use client';

import { Button, InitialsBadge, NavMenu } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';

interface HeroProps {
  onOpenChat: () => void;
}

export function Hero({ onOpenChat }: HeroProps) {
  return (
    <>
      {/* Fixed Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between bg-[var(--color-bg)]/80 px-6 py-4 backdrop-blur-sm">
        <InitialsBadge />
        <NavMenu />
      </header>

      {/* Hero Section */}
      <section
        id="hero"
        className="flex min-h-screen flex-col justify-center px-6 py-20"
      >
        <div className="mx-auto w-full max-w-5xl">
          {/* Status Pill */}
          <div className="mb-8 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent-green)]" />
            <span className="text-sm text-[var(--color-text-muted)]">
              Open to {resumeData.openToRoles.join(', ')} roles
            </span>
          </div>

          {/* Name */}
          <h1 className="mb-4 text-[var(--color-text)]">{resumeData.name}</h1>

          {/* Title */}
          <p className="mb-4 text-3xl font-medium text-[var(--color-text-title)] md:text-4xl">
            {resumeData.title}
          </p>

          {/* Tagline */}
          <p className="mb-8 max-w-2xl text-lg text-[var(--color-text-muted)]">
            {resumeData.tagline}
          </p>

          {/* Experience Tags */}
          <div className="mb-10 flex flex-wrap gap-3">
            {resumeData.experienceTags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2 text-sm text-[var(--color-text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* CTA Button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={onOpenChat}
              size="lg"
              className="bg-[var(--color-accent-green)] text-[var(--color-bg)] hover:bg-[var(--color-accent-green)]/90"
            >
              Ask AI About Me
            </Button>
            <span className="rounded-full bg-[var(--color-accent-green)]/20 px-2 py-1 text-xs font-medium text-[var(--color-accent-green)]">
              New
            </span>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
          <p className="mb-2 text-xs uppercase tracking-widest text-[var(--color-text-muted)]">
            Scroll to explore
          </p>
          <svg
            className="mx-auto h-5 w-5 animate-bounce text-[var(--color-text-muted)]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </section>
    </>
  );
}
