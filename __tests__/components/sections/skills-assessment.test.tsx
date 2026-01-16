import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SkillsAssessment } from '@/components/sections/skills-assessment';

describe('SkillsAssessment', () => {
  it('renders the section heading', () => {
    render(<SkillsAssessment />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Skills Assessment');
  });

  it('renders strong skills card', () => {
    render(<SkillsAssessment />);
    expect(screen.getByRole('heading', { name: 'Strong' })).toBeInTheDocument();
    expect(screen.getByText('Platform/Infrastructure Architecture')).toBeInTheDocument();
  });

  it('renders moderate skills card', () => {
    render(<SkillsAssessment />);
    expect(screen.getByRole('heading', { name: 'Moderate' })).toBeInTheDocument();
    expect(screen.getByText('Data Engineering')).toBeInTheDocument();
  });

  it('renders gaps skills card', () => {
    render(<SkillsAssessment />);
    expect(screen.getByRole('heading', { name: 'Gaps' })).toBeInTheDocument();
    expect(screen.getByText('Consumer Product')).toBeInTheDocument();
  });

  it('has correct section id for navigation', () => {
    render(<SkillsAssessment />);
    expect(document.getElementById('skills-assessment')).toBeInTheDocument();
  });
});
