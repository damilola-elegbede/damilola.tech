import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About the AI Assistant | Damilola Elegbede',
  description: 'Learn how the AI chatbot works and what questions you can ask.',
};

export default function AIAssistantPage() {
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

        <h1 className="text-3xl font-bold text-[var(--color-text)]">About the AI Assistant</h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          An interactive way to learn about my background and experience.
        </p>

        <div className="mt-8 space-y-8">
          {/* How it works */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">How It Works</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              The AI assistant is powered by Claude, Anthropic&apos;s AI model. It has been provided with
              detailed information about my professional background, including:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
              <li>Complete work history and role responsibilities</li>
              <li>Technical skills and proficiencies</li>
              <li>Leadership experience and management philosophy</li>
              <li>Notable projects and achievements</li>
              <li>Education and certifications</li>
            </ul>
          </section>

          {/* What to ask */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">What You Can Ask</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Feel free to ask questions like:
            </p>
            <div className="mt-3 grid gap-2">
              {[
                'Tell me about your experience with distributed systems',
                'What leadership roles have you held?',
                'How do you approach technical decision-making?',
                'What technologies are you most experienced with?',
                'Can you describe a challenging project you led?',
                'What is your management philosophy?',
              ].map((question) => (
                <div
                  key={question}
                  className="rounded-lg bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)]"
                >
                  &ldquo;{question}&rdquo;
                </div>
              ))}
            </div>
          </section>

          {/* Limitations */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Limitations</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              The AI assistant is designed to help recruiters and hiring managers learn about my
              background efficiently. However, please note:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-[var(--color-text-muted)]">
              <li>It can only answer questions about my professional background</li>
              <li>It won&apos;t speculate about topics outside its knowledge</li>
              <li>For detailed discussions, please reach out directly via email</li>
              <li>Responses are AI-generated and should be verified in interviews</li>
            </ul>
          </section>

          {/* Technology */}
          <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">Technology</h2>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              The assistant uses a full context window approach rather than RAG (Retrieval-Augmented
              Generation). This means all relevant information is included in every request,
              enabling more coherent and contextually aware responses.
            </p>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Built with the Vercel AI SDK and Anthropic&apos;s Claude API, with prompt caching
              enabled for improved response times.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
