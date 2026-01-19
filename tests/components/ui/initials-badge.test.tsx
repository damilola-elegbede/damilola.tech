import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InitialsBadge } from '@/components/ui/initials-badge';

describe('InitialsBadge', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it('renders default initials', () => {
    render(<InitialsBadge />);
    expect(screen.getByText('DE')).toBeInTheDocument();
  });

  it('renders custom initials', () => {
    render(<InitialsBadge initials="JD" />);
    expect(screen.getByText('JD')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<InitialsBadge className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders as a button', () => {
    render(<InitialsBadge />);
    expect(screen.getByRole('button', { name: /go to top/i })).toBeInTheDocument();
  });

  it('scrolls to top when clicked', () => {
    render(<InitialsBadge />);
    const button = screen.getByRole('button', { name: /go to top/i });

    fireEvent.click(button);

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('has accessible label', () => {
    render(<InitialsBadge />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label', 'Go to top of page');
  });

  it('has hover styles', () => {
    render(<InitialsBadge />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('hover:border-[var(--color-accent)]');
    expect(button).toHaveClass('hover:text-[var(--color-accent)]');
  });
});
