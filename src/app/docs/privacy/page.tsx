import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy & Data | Damilola Elegbede',
  description: 'How your data is handled when using this site.',
};

export default function PrivacyPage() {
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

        <h1 className="text-3xl font-bold text-[var(--color-text)]">Privacy & Data</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Transparency about how this site handles your data.
        </p>

        <div className="mt-8 space-y-8">
          {/* Data Collection */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">What Data Is Collected</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              When you visit this site, the following information may be collected:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
              <li>Page views and navigation patterns</li>
              <li>Traffic source (how you arrived at the site)</li>
              <li>Browser type and general device information</li>
              <li>Chat messages sent to the AI assistant</li>
              <li>Fit assessment submissions (if you use that feature)</li>
            </ul>
          </section>

          {/* How Data is Used */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">How Data Is Used</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Collected data is used to:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
              <li>Understand which traffic sources are most effective</li>
              <li>Improve the site experience based on usage patterns</li>
              <li>Process AI chat requests through Anthropic&apos;s Claude API</li>
              <li>Generate fit assessments when requested</li>
            </ul>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Data is not sold to third parties or used for advertising purposes.
            </p>
          </section>

          {/* Chat Data */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">AI Chat Data</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Messages sent to the AI assistant are:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
              <li>Processed by Anthropic&apos;s Claude API to generate responses</li>
              <li>Subject to Anthropic&apos;s data usage policies</li>
              <li>Stored for a limited time to enable conversation continuity</li>
              <li>Not used to train AI models (per Anthropic&apos;s API terms)</li>
            </ul>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              Avoid sharing sensitive personal information in chat messages.
            </p>
          </section>

          {/* Cookies and Storage */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Cookies & Local Storage</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              This site uses browser storage for:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
              <li>Session identification (anonymous, no personal data)</li>
              <li>Traffic source attribution (to understand how you found the site)</li>
              <li>Chat history within your current session</li>
            </ul>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              No third-party tracking cookies are used.
            </p>
          </section>

          {/* Contact */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Questions?</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              If you have questions about data handling or would like your data removed,
              please reach out via the contact information on the main page.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
