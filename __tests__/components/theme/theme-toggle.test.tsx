import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { ThemeProvider } from '@/components/theme/theme-provider';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock matchMedia
const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', { value: matchMediaMock });

function renderWithProvider(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorageMock.clear();
    document.documentElement.setAttribute('data-theme', 'light');
  });

  it('renders the toggle button', async () => {
    renderWithProvider(<ThemeToggle />);
    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  it('has correct aria-label for light mode', async () => {
    renderWithProvider(<ThemeToggle />);
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        'Switch to dark mode'
      );
    });
  });

  it('toggles theme when clicked', async () => {
    renderWithProvider(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');

    // Initially light mode
    expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');

    // Click to switch to dark mode
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Switch to light mode');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Click to switch back to light mode
    fireEvent.click(button);
    await waitFor(() => {
      expect(button).toHaveAttribute('aria-label', 'Switch to dark mode');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('persists theme to localStorage', async () => {
    renderWithProvider(<ThemeToggle />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    const button = screen.getByRole('button');

    fireEvent.click(button);
    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  it('applies custom className', async () => {
    renderWithProvider(<ThemeToggle className="custom-class" />);
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveClass('custom-class');
    });
  });

  it('has proper focus styles', async () => {
    renderWithProvider(<ThemeToggle />);
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveClass('focus-visible:ring-2');
    });
  });
});
