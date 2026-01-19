import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FitAssessment } from '@/components/sections/fit-assessment';

// Mock useCompletion hook from @ai-sdk/react
const mockComplete = vi.fn();
const mockSetCompletion = vi.fn();
let mockIsLoading = false;
let mockCompletion = '';

vi.mock('@ai-sdk/react', () => ({
  useCompletion: () => ({
    completion: mockCompletion,
    isLoading: mockIsLoading,
    complete: mockComplete,
    setCompletion: mockSetCompletion,
  }),
}));

// Mock fetch for examples API
const mockExamples = {
  strong: '# Engineering Manager, Platform Infrastructure\nThis is a strong fit example...',
  weak: '# Staff Frontend Engineer\nThis is a weak fit example...',
};

describe('FitAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsLoading = false;
    mockCompletion = '';

    // Mock global fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockExamples),
    });
  });

  it('renders the section heading', () => {
    render(<FitAssessment />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Fit Assessment'
    );
  });

  it('renders the tagline', () => {
    render(<FitAssessment />);
    expect(
      screen.getByText(/Paste a job description/i)
    ).toBeInTheDocument();
  });

  it('has correct section id for navigation', () => {
    render(<FitAssessment />);
    expect(document.getElementById('fit-assessment')).toBeInTheDocument();
  });

  it('renders example buttons', async () => {
    render(<FitAssessment />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /strong fit example/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /weak fit example/i })).toBeInTheDocument();
    });
  });

  it('renders textarea for job description', () => {
    render(<FitAssessment />);
    expect(screen.getByRole('textbox', { name: /job description/i })).toBeInTheDocument();
  });

  it('renders analyze button', () => {
    render(<FitAssessment />);
    expect(screen.getByRole('button', { name: /analyze fit/i })).toBeInTheDocument();
  });

  it('populates textarea when strong fit example is clicked', async () => {
    render(<FitAssessment />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /strong fit example/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /strong fit example/i }));

    const textarea = screen.getByRole('textbox', { name: /job description/i });
    expect(textarea).toHaveValue(mockExamples.strong);
  });

  it('populates textarea when weak fit example is clicked', async () => {
    render(<FitAssessment />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /weak fit example/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /weak fit example/i }));

    const textarea = screen.getByRole('textbox', { name: /job description/i });
    expect(textarea).toHaveValue(mockExamples.weak);
  });

  it('disables analyze button when textarea is empty', () => {
    render(<FitAssessment />);
    const button = screen.getByRole('button', { name: /analyze fit/i });
    expect(button).toBeDisabled();
  });

  it('enables analyze button when textarea has content', async () => {
    render(<FitAssessment />);
    const textarea = screen.getByRole('textbox', { name: /job description/i });

    fireEvent.change(textarea, { target: { value: 'Some job description' } });

    const button = screen.getByRole('button', { name: /analyze fit/i });
    expect(button).not.toBeDisabled();
  });

  it('calls complete when analyze button is clicked', async () => {
    render(<FitAssessment />);
    const textarea = screen.getByRole('textbox', { name: /job description/i });

    fireEvent.change(textarea, { target: { value: 'Engineering Manager role' } });
    fireEvent.click(screen.getByRole('button', { name: /analyze fit/i }));

    expect(mockSetCompletion).toHaveBeenCalledWith('');
    expect(mockComplete).toHaveBeenCalledWith('Engineering Manager role');
  });

  it('shows loading state during analysis', () => {
    mockIsLoading = true;
    render(<FitAssessment />);

    const textarea = screen.getByRole('textbox', { name: /job description/i });
    fireEvent.change(textarea, { target: { value: 'Some job description' } });

    expect(screen.getByRole('button', { name: /analyzing/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /analyzing/i })).toBeDisabled();
  });

  it('displays assessment result when completion is available', () => {
    mockCompletion = '# Fit Assessment: Engineering Manager\n\n**Fit Rating: Strong Match**';
    render(<FitAssessment />);

    // The completion should be rendered as markdown
    expect(screen.getByText(/Fit Assessment: Engineering Manager/)).toBeInTheDocument();
    expect(screen.getByText(/Strong Match/)).toBeInTheDocument();
  });

  it('shows placeholder text during loading with no completion', () => {
    mockIsLoading = true;
    mockCompletion = '';
    render(<FitAssessment />);

    expect(screen.getByText(/Analyzing job fit/i)).toBeInTheDocument();
  });

  it('fetches examples on mount', async () => {
    render(<FitAssessment />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/fit-examples');
    });
  });

  it('disables example buttons while loading examples', () => {
    // Set up fetch to be slow
    global.fetch = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve(mockExamples),
      }), 1000))
    );

    render(<FitAssessment />);

    expect(screen.getByRole('button', { name: /strong fit example/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /weak fit example/i })).toBeDisabled();
  });
});
