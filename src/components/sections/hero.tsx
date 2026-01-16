'use client';

import { Button, InitialsBadge, NavMenu, SocialLinks } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';

interface HeroProps {
  onOpenChat: () => void;
}

export function Hero({ onOpenChat }: HeroProps) {
  return (
    <>
      {/* Fixed Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex items-center justify-between px-6 py-4">
        <InitialsBadge />
        <NavMenu />
      </header>

      {/* Hero Section */}
      <section
        id="hero"
        className="flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center"
      >
        <div className="mx-auto max-w-3xl">
          <h1 className="mb-4 text-[var(--color-text)]">{resumeData.name}</h1>
          <p className="mb-6 text-2xl font-medium text-[var(--color-accent)]">
            {resumeData.title}
          </p>
          <p className="mb-8 text-xl text-[var(--color-text-muted)]">
            {resumeData.tagline}
          </p>

          {/* Social Links */}
          <SocialLinks className="mb-10 justify-center" iconSize="lg" />

          {/* CTA Button */}
          <Button onClick={onOpenChat} size="lg">
            Ask AI About My Experience
          </Button>
        </div>
      </section>
    </>
  );
}
