import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About This Site | Damilola Elegbede',
  description: 'Technical details about how this portfolio was built.',
};

export default function AboutSitePage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/docs"
          className="mb-8 inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Docs
        </Link>

        <h1 className="text-3xl font-bold text-[var(--color-text)]">About This Site</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          A look at the technology and approach behind this portfolio.
        </p>

        <div className="mt-8 space-y-8">
          {/* Overview */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Overview</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              This site serves as a modern job search landing page, designed to give recruiters
              and hiring managers an interactive way to learn about my background. Rather than
              a static resume, it provides an AI-powered conversation interface alongside
              traditional portfolio elements.
            </p>
          </section>

          {/* Tech Stack */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Tech Stack</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">Frontend</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
                  <li>Next.js 16 (App Router)</li>
                  <li>TypeScript (strict mode)</li>
                  <li>Tailwind CSS</li>
                  <li>Geist font family</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">AI & Backend</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
                  <li>Anthropic Claude API</li>
                  <li>Vercel AI SDK</li>
                  <li>Vercel Blob Storage</li>
                  <li>Edge Functions</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">Testing</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
                  <li>Vitest (unit tests)</li>
                  <li>React Testing Library</li>
                  <li>Playwright (E2E)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">Infrastructure</h3>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
                  <li>Vercel (hosting)</li>
                  <li>GitHub (source control)</li>
                  <li>GitHub Actions (CI)</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Design Philosophy */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Design Philosophy</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              The design follows a clean, professional aesthetic inspired by modern consulting
              firms. Key principles include:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
              <li>High contrast for readability</li>
              <li>Minimal decorative elements</li>
              <li>Consistent spacing and typography</li>
              <li>Dark mode by default (easier on the eyes)</li>
              <li>Mobile-responsive layout</li>
            </ul>
          </section>

          {/* Key Features */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Key Features</h2>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">AI Chat Assistant</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Full context window approach (no RAG) with prompt caching for efficient,
                  contextually aware responses about my professional background.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">Role Fit Assessment</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Paste a job description to get an AI-generated analysis of how my experience
                  aligns with the role requirements.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">ATS-Optimized Resume Generator</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Generate tailored resumes optimized for specific job descriptions with
                  keyword matching and ATS compatibility scoring.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-[var(--color-text)]">Traffic Analytics</h3>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  UTM parameter tracking and referrer classification to understand which
                  outreach channels are most effective.
                </p>
              </div>
            </div>
          </section>

          {/* Development Approach */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Development Approach</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              This site was built using Test-Driven Development (TDD) principles with
              comprehensive test coverage. Development was assisted by Claude Code,
              Anthropic&apos;s AI-powered development tool, demonstrating practical
              application of AI in software development workflows.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
