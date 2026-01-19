'use client';

interface InitialsBadgeProps {
  initials?: string;
  className?: string;
}

export function InitialsBadge({ initials = 'DE', className = '' }: InitialsBadgeProps) {
  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex h-12 w-12 cursor-pointer items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] font-serif text-xl font-bold text-[var(--color-text)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] ${className}`}
      aria-label="Go to top of page"
    >
      {initials}
    </button>
  );
}
