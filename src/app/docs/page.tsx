import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentation | Damilola Elegbede',
  description: 'Learn more about this site, the AI assistant, and how to get in touch.',
};

interface DocLink {
  title: string;
  description: string;
  href: string;
}

const docs: DocLink[] = [
  {
    title: 'About the AI Assistant',
    description: 'Learn how the AI chatbot works and what questions you can ask.',
    href: '/docs/ai-assistant',
  },
  {
    title: 'Privacy & Data',
    description: 'How your data is handled when using this site.',
    href: '/docs/privacy',
  },
  {
    title: 'About This Site',
    description: 'Technical details about how this portfolio was built.',
    href: '/docs/about',
  },
];

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-[var(--color-bg)] px-4 py-16">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)]"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <h1 className="text-3xl font-bold text-[var(--color-text)]">Documentation</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Resources and information about this site.
        </p>

        <div className="mt-8 grid gap-4">
          {docs.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className="group rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6 transition-colors hover:border-[var(--color-accent)]"
            >
              <h2 className="text-lg font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
                {doc.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{doc.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
