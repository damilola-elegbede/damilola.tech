import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NavMenu } from '@/components/ui/nav-menu';

describe('NavMenu', () => {
  it('renders hamburger button', () => {
    render(<NavMenu />);
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument();
  });

  it('opens menu on button click', () => {
    render(<NavMenu />);
    const button = screen.getByRole('button', { name: /open menu/i });

    fireEvent.click(button);

    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /experience/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /skills/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /education/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /contact/i })).toBeInTheDocument();
  });

  it('closes menu on button click when open', () => {
    render(<NavMenu />);
    const button = screen.getByRole('button', { name: /open menu/i });

    // Open menu
    fireEvent.click(button);
    expect(screen.getByRole('navigation')).toBeInTheDocument();

    // Close menu
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('nav links have correct hrefs', () => {
    render(<NavMenu />);
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));

    expect(screen.getByRole('link', { name: /experience/i })).toHaveAttribute('href', '#experience');
    expect(screen.getByRole('link', { name: /skills/i })).toHaveAttribute('href', '#skills-assessment');
    expect(screen.getByRole('link', { name: /education/i })).toHaveAttribute('href', '#education');
    expect(screen.getByRole('link', { name: /contact/i })).toHaveAttribute('href', '#contact');
  });
});
