import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeProvider, useTheme } from '@/components/theme/theme-provider';

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
let matchMediaListeners: Array<(e: MediaQueryListEvent) => void> = [];
const matchMediaMock = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
    if (event === 'change') {
      matchMediaListeners.push(listener);
    }
  }),
  removeEventListener: vi.fn((event: string, listener: (e: MediaQueryListEvent) => void) => {
    if (event === 'change') {
      matchMediaListeners = matchMediaListeners.filter((l) => l !== listener);
    }
  }),
  dispatchEvent: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', { value: matchMediaMock });

// Test component that uses the theme context
function TestConsumer() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={() => setTheme('dark')} data-testid="set-dark">
        Set Dark
      </button>
      <button onClick={() => setTheme('light')} data-testid="set-light">
        Set Light
      </button>
      <button onClick={toggleTheme} data-testid="toggle">
        Toggle
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorageMock.clear();
    matchMediaListeners = [];
    document.documentElement.setAttribute('data-theme', 'light');
  });

  it('provides theme context to children', async () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });
  });

  it('setTheme updates the theme', async () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('set-dark')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('set-dark'));

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    });
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggleTheme switches between light and dark', async () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });

    // Toggle to dark
    fireEvent.click(screen.getByTestId('toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    });

    // Toggle back to light
    fireEvent.click(screen.getByTestId('toggle'));
    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });
  });

  it('persists theme to localStorage', async () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('set-dark')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('set-dark'));

    await waitFor(() => {
      expect(localStorageMock.setItem).toHaveBeenCalledWith('theme', 'dark');
    });
  });

  it('reads initial theme from data-theme attribute', async () => {
    document.documentElement.setAttribute('data-theme', 'dark');

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    });
  });

  it('throws error when useTheme is used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer />);
    }).toThrow('useTheme must be used within a ThemeProvider');

    consoleSpy.mockRestore();
  });

  it('responds to system preference changes when no stored theme', async () => {
    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });

    // Simulate system preference change to dark
    act(() => {
      matchMediaListeners.forEach((listener) => {
        listener({ matches: true } as MediaQueryListEvent);
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark');
    });
  });

  it('ignores system preference changes when theme is stored', async () => {
    localStorageMock.getItem.mockReturnValue('light');

    render(
      <ThemeProvider>
        <TestConsumer />
      </ThemeProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });

    // Simulate system preference change to dark
    act(() => {
      matchMediaListeners.forEach((listener) => {
        listener({ matches: true } as MediaQueryListEvent);
      });
    });

    // Should stay light because user has explicit preference
    await waitFor(() => {
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light');
    });
  });
});
