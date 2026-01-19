'use client';

import { useState, useCallback, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';

interface ExampleJDs {
  strong: string;
  weak: string;
}

export function FitAssessment() {
  const [jobDescription, setJobDescription] = useState('');
  const [completion, setCompletion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [examples, setExamples] = useState<ExampleJDs | null>(null);
  const [examplesLoading, setExamplesLoading] = useState(true);
  const [examplesError, setExamplesError] = useState(false);
  const { ref, isVisible } = useScrollReveal();

  // Fetch example JDs on mount
  useEffect(() => {
    async function loadExamples() {
      try {
        const res = await fetch('/api/fit-examples');
        if (res.ok) {
          const data = await res.json();
          setExamples(data);
        } else {
          setExamplesError(true);
        }
      } catch (err) {
        console.error('Failed to load example JDs:', err);
        setExamplesError(true);
      } finally {
        setExamplesLoading(false);
      }
    }
    loadExamples();
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!jobDescription.trim()) return;

    setIsLoading(true);
    setError(null);
    setCompletion('');

    try {
      const res = await fetch('/api/fit-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: jobDescription }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze fit');
      }

      setCompletion(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  }, [jobDescription]);

  return (
    <section id="fit-assessment" className="bg-[var(--color-bg-alt)] px-6 py-20">
      <div
        ref={ref as React.RefObject<HTMLDivElement>}
        className={cn(
          'mx-auto max-w-5xl transition-all duration-700 ease-out',
          isVisible ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}
      >
        <h2 className="mb-4 text-3xl text-[var(--color-text)] md:text-4xl">
          Fit Assessment
        </h2>
        <p className="mb-8 text-lg text-[var(--color-text-muted)]">
          Paste a job description. Get an honest assessment of whether I&apos;m the
          right person—including when I&apos;m not.
        </p>

        {/* Example Buttons */}
        <div className="mb-4 flex flex-wrap justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => examples && setJobDescription(examples.strong)}
            disabled={examplesLoading || !examples}
          >
            Strong Fit Example
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => examples && setJobDescription(examples.weak)}
            disabled={examplesLoading || !examples}
          >
            Weak Fit Example
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setJobDescription('')}
            disabled={!jobDescription}
          >
            Clear
          </Button>
        </div>

        {/* Textarea */}
        <textarea
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
          placeholder="Paste job description here..."
          className="mb-4 h-[30rem] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          aria-label="Job description"
        />

        {/* Submit Button */}
        <Button
          onClick={handleAnalyze}
          disabled={isLoading || !jobDescription.trim()}
          className="mb-8"
        >
          {isLoading ? 'Analyzing...' : 'Analyze Fit'}
        </Button>

        {/* Error Display */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
            <p className="font-medium">Unable to analyze fit</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Assessment Result */}
        {(completion || isLoading) && (
          <div
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6"
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{completion || 'Analyzing job fit...'}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
