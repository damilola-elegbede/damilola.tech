/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRenderToBuffer = vi.fn();

vi.mock('@react-pdf/renderer', () => ({
  Document: (props: { children: unknown }) => props.children,
  Page: (props: { children: unknown }) => props.children,
  Text: () => null,
  View: (props: { children: unknown }) => props.children,
  StyleSheet: { create: (s: unknown) => s },
  renderToBuffer: (...args: unknown[]) => mockRenderToBuffer(...args),
}));

vi.mock('@/lib/resume-data', () => ({
  resumeData: {
    name: 'Test User',
    title: 'Engineer',
    tagline: 'A tagline',
    brandingStatement: 'A statement',
    email: 'test@example.com',
    linkedin: 'https://linkedin.com/in/test',
    github: 'https://github.com/test',
    location: 'Boulder, CO',
    openToRoles: [],
    experienceTags: [],
    experiences: [
      {
        id: 'exp1',
        company: 'Acme',
        title: 'SWE',
        location: 'Remote',
        startDate: 'Jan 2020',
        endDate: 'Present',
        highlights: ['Built things'],
      },
    ],
    skills: [{ category: 'Tech', items: ['TypeScript', 'React'] }],
    skillsAssessment: { expert: [], proficient: [], familiar: [] },
    education: [
      { id: 'ms', degree: 'MS Computer Science', institution: 'State U' },
    ],
  },
}));

describe('GET /api/v1/resume.pdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockRenderToBuffer.mockResolvedValue(Buffer.from('%PDF-1.4 fake-content'));
  });

  it('returns 200 with Content-Type application/pdf', async () => {
    const { GET } = await import('@/app/api/v1/resume.pdf/route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
  });

  it('returns correct Content-Disposition header', async () => {
    const { GET } = await import('@/app/api/v1/resume.pdf/route');
    const response = await GET();
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="damilola-elegbede-resume.pdf"'
    );
  });

  it('returns no-store Cache-Control', async () => {
    const { GET } = await import('@/app/api/v1/resume.pdf/route');
    const response = await GET();
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns a non-empty body', async () => {
    const { GET } = await import('@/app/api/v1/resume.pdf/route');
    const response = await GET();
    const buffer = await response.arrayBuffer();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });

  it('returns 500 JSON when PDF generation throws', async () => {
    mockRenderToBuffer.mockRejectedValue(new Error('render failed'));
    const { GET } = await import('@/app/api/v1/resume.pdf/route');
    const response = await GET();
    expect(response.status).toBe(500);
    const data = await response.json() as { success: boolean };
    expect(data.success).toBe(false);
  });
});
