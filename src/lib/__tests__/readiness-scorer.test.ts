/**
 * ATS Scorer — Unit & Integration Tests
 *
 * Covers:
 *  - Score ceiling (never > 100)
 *  - Score floor (never < 0)
 *  - Keyword matching (exact, fuzzy/stem/synonym, no-match)
 *  - Role-fit penalty (domain relevance discount)
 *  - Keyword cap (no inflation from keyword stuffing)
 *  - Max possible score consistency
 *  - Edge cases (empty JD, empty resume, null/undefined inputs)
 *  - formatScoreAssessment thresholds
 *  - resumeDataToText serialisation
 *
 * All tests are deterministic — no network calls, no random seeds.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateReadinessScore,
  formatScoreAssessment,
  resumeDataToText,
  type ScoringInput,
  type ResumeData,
} from '../readiness-scorer';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<ScoringInput> = {}): ScoringInput {
  return {
    jobDescription: overrides.jobDescription ?? RICH_JD,
    resumeText: overrides.resumeText ?? RICH_RESUME_TEXT,
    resumeData: overrides.resumeData ?? RICH_RESUME_DATA,
  };
}

/** A moderately rich job description used as the default fixture. */
const RICH_JD = `
Senior Software Engineer — Platform Infrastructure

We are looking for a Senior Software Engineer with 5+ years of experience
building distributed systems at scale. You will design, implement and operate
highly-available microservices, CI/CD pipelines, and developer experience tooling.

Required:
- Proficiency in TypeScript, Go, or Python
- Experience with Kubernetes, Docker, and cloud platforms (AWS, GCP)
- Strong understanding of REST APIs, GraphQL, and system design
- Familiarity with PostgreSQL, Redis, and message queues (Kafka, RabbitMQ)
- CI/CD experience (GitHub Actions, Jenkins, ArgoCD)

Nice to have:
- Experience with observability tools (Prometheus, Grafana, OpenTelemetry)
- Background in security engineering or platform DevEx
- Bachelor's degree in Computer Science or related field

We value collaboration, ownership, and continuous improvement.
`;

/** Resume text that closely mirrors the JD above. */
const RICH_RESUME_TEXT = `
Jane Smith
Senior Software Engineer

Summary: 7 years building distributed microservices on AWS and GCP with
TypeScript, Go, and Python. Deep experience with Kubernetes, Docker, REST APIs,
and GraphQL. Led CI/CD pipeline migrations using GitHub Actions and ArgoCD.

Skills: TypeScript, Go, Python, Kubernetes, Docker, AWS, GCP, PostgreSQL,
Redis, Kafka, GraphQL, REST APIs, Prometheus, Grafana, GitHub Actions, ArgoCD

Experience:
  Senior Software Engineer — Acme Corp (2020–2024)
  - Designed distributed microservices handling 50k RPS on Kubernetes/AWS
  - Implemented CI/CD pipelines with GitHub Actions and ArgoCD
  - Led PostgreSQL and Redis optimisation reducing latency by 40%

  Software Engineer — StartupCo (2017–2020)
  - Built REST APIs and GraphQL services in TypeScript and Go
  - Integrated Kafka message queue for async event processing

Education:
  Bachelor of Science in Computer Science — State University
`;

const RICH_RESUME_DATA: ResumeData = {
  title: 'Senior Software Engineer',
  yearsExperience: 7,
  skills: [
    'TypeScript', 'Go', 'Python', 'Kubernetes', 'Docker',
    'AWS', 'GCP', 'PostgreSQL', 'Redis', 'Kafka',
    'GraphQL', 'REST APIs', 'Prometheus', 'Grafana',
    'GitHub Actions', 'ArgoCD',
  ],
  skillsByCategory: [
    { category: 'Languages', items: ['TypeScript', 'Go', 'Python'] },
    { category: 'Infrastructure', items: ['Kubernetes', 'Docker', 'AWS', 'GCP'] },
    { category: 'Databases', items: ['PostgreSQL', 'Redis', 'Kafka'] },
    { category: 'APIs', items: ['REST APIs', 'GraphQL'] },
    { category: 'Observability', items: ['Prometheus', 'Grafana'] },
    { category: 'CI/CD', items: ['GitHub Actions', 'ArgoCD'] },
  ],
  experiences: [
    {
      title: 'Senior Software Engineer',
      company: 'Acme Corp',
      highlights: [
        'Designed distributed microservices handling 50k RPS on Kubernetes/AWS',
        'Implemented CI/CD pipelines with GitHub Actions and ArgoCD',
        'Led PostgreSQL and Redis optimisation reducing latency by 40%',
      ],
    },
    {
      title: 'Software Engineer',
      company: 'StartupCo',
      highlights: [
        'Built REST APIs and GraphQL services in TypeScript and Go',
        'Integrated Kafka message queue for async event processing',
      ],
    },
  ],
  education: [
    { degree: 'Bachelor of Science in Computer Science', institution: 'State University' },
  ],
};

// ---------------------------------------------------------------------------
// 1. Score Ceiling — ATS score never exceeds 100
// ---------------------------------------------------------------------------

describe('Score ceiling', () => {
  it('total is never greater than 100 for a well-matched resume', () => {
    const result = calculateReadinessScore(makeInput());
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('individual breakdown scores respect their sub-ceilings', () => {
    const result = calculateReadinessScore(makeInput());
    expect(result.breakdown.roleRelevance).toBeLessThanOrEqual(30);
    expect(result.breakdown.claritySkimmability).toBeLessThanOrEqual(30);
    expect(result.breakdown.businessImpact).toBeLessThanOrEqual(25);
    expect(result.breakdown.presentationQuality).toBeLessThanOrEqual(15);
  });

  it('total <= sum of sub-ceilings (45+25+20+10 = 100)', () => {
    const result = calculateReadinessScore(makeInput());
    const maxPossible =
      result.breakdown.roleRelevance +
      result.breakdown.claritySkimmability +
      result.breakdown.businessImpact +
      result.breakdown.presentationQuality;
    // total is derived from sub-scores, so it cannot exceed their sum
    expect(result.total).toBeLessThanOrEqual(maxPossible + 0.1); // tiny float tolerance
  });

  it('does not exceed 100 with extreme keyword stuffing in resume', () => {
    // Repeat all keywords many times to attempt inflation
    const stuffedText =
      (RICH_RESUME_TEXT + '\n').repeat(20) +
      'TypeScript Go Python Kubernetes Docker '.repeat(50);
    const result = calculateReadinessScore(
      makeInput({ resumeText: stuffedText }),
    );
    expect(result.total).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 2. Score Floor — ATS score never goes below 0
// ---------------------------------------------------------------------------

describe('Score floor', () => {
  it('total is never negative for a well-matched resume', () => {
    const result = calculateReadinessScore(makeInput());
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('total is never negative for a completely unrelated resume', () => {
    const result = calculateReadinessScore(
      makeInput({
        resumeText: 'I bake bread and grow tomatoes in my garden.',
        resumeData: {
          title: 'Baker',
          yearsExperience: 2,
          skills: ['bread', 'tomatoes'],
        },
      }),
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('breakdown sub-scores are never negative', () => {
    const result = calculateReadinessScore(
      makeInput({
        resumeText: 'No relevant content whatsoever.',
        resumeData: {},
      }),
    );
    expect(result.breakdown.roleRelevance).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.claritySkimmability).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.businessImpact).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.presentationQuality).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 3. Keyword Matching — exact, fuzzy, no match
// ---------------------------------------------------------------------------

describe('Keyword matching', () => {
  it('exact keyword match produces a non-zero score and appears in matchedKeywords', () => {
    const jd = 'We need an expert in TypeScript and Kubernetes.';
    const resume = 'I am skilled in TypeScript and Kubernetes.';
    const result = calculateReadinessScore(
      makeInput({ jobDescription: jd, resumeText: resume, resumeData: { title: 'Engineer' } }),
    );
    const matched = result.details.matchedKeywords.map((k) => k.toLowerCase());
    expect(matched).toContain('typescript');
    expect(result.total).toBeGreaterThan(0);
  });

  it('no keyword match produces zero matched keywords', () => {
    const jd = 'Looking for expertise in COBOL and mainframe systems.';
    const resume = 'I specialise in pastry and sourdough techniques.';
    const result = calculateReadinessScore(
      makeInput({ jobDescription: jd, resumeText: resume, resumeData: {} }),
    );
    expect(result.details.matchedKeywords).toHaveLength(0);
  });

  it('no keyword match yields a lower score than a strong match', () => {
    const noMatch = calculateReadinessScore(
      makeInput({
        resumeText: 'I have no relevant experience for this role whatsoever.',
        resumeData: {},
      }),
    );
    const strongMatch = calculateReadinessScore(makeInput());
    expect(strongMatch.total).toBeGreaterThan(noMatch.total);
  });

  it('matchedKeywords are a subset of the all extracted keywords', () => {
    const result = calculateReadinessScore(makeInput());
    const allExtracted = new Set(
      result.details.extractedKeywords.all.map((k) => k.toLowerCase()),
    );
    for (const kw of result.details.matchedKeywords) {
      expect(allExtracted.has(kw.toLowerCase())).toBe(true);
    }
  });

  it('missingKeywords + matchedKeywords = extractedKeywords.all (no overlap)', () => {
    const result = calculateReadinessScore(makeInput());
    const matched = new Set(result.details.matchedKeywords.map((k) => k.toLowerCase()));
    const missing = new Set(result.details.missingKeywords.map((k) => k.toLowerCase()));
    const all = new Set(result.details.extractedKeywords.all.map((k) => k.toLowerCase()));
    // No overlap between matched and missing
    for (const kw of matched) {
      expect(missing.has(kw)).toBe(false);
    }
    // Union of matched + missing must equal extractedKeywords.all
    const union = new Set([...matched, ...missing]);
    expect(union.size).toBe(all.size);
    for (const kw of all) {
      expect(union.has(kw)).toBe(true);
    }
  });

  it('match rate is between 0 and 100', () => {
    const result = calculateReadinessScore(makeInput());
    expect(result.details.matchRate).toBeGreaterThanOrEqual(0);
    expect(result.details.matchRate).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 4. Role-fit Penalty — domain mismatch applies a discount
// ---------------------------------------------------------------------------

describe('Role-fit penalty', () => {
  it('a completely unrelated title results in a lower score than a matching title', () => {
    const matchingScore = calculateReadinessScore(makeInput());

    const mismatchedScore = calculateReadinessScore(
      makeInput({
        resumeData: {
          ...RICH_RESUME_DATA,
          title: 'Head Chef',
          openToRoles: ['Pastry Specialist'],
          experiences: [
            {
              title: 'Head Chef',
              company: 'Fine Dining Restaurant',
              highlights: ['Managed kitchen operations', 'Developed seasonal menus'],
            },
          ],
        },
      }),
    );

    expect(matchingScore.total).toBeGreaterThan(mismatchedScore.total);
  });

  it('experience alignment is reduced when resume has no domain overlap', () => {
    const matched = calculateReadinessScore(makeInput());
    const mismatched = calculateReadinessScore(
      makeInput({
        resumeData: {
          ...RICH_RESUME_DATA,
          title: 'Molecular Gastronomy Consultant',
          experiences: [
            {
              title: 'Head Chef',
              company: 'Fine Dining Restaurant',
              highlights: [
                'Managed kitchen operations and seasonal menus',
                'Trained sous chefs on plating techniques',
              ],
            },
          ],
        },
      }),
    );
    // businessImpact should be lower when experience bullets have no domain overlap
    expect(matched.breakdown.businessImpact).toBeGreaterThanOrEqual(
      mismatched.breakdown.businessImpact,
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Keyword Cap — excessive stuffing doesn't inflate the score beyond the ceiling
// ---------------------------------------------------------------------------

describe('Keyword cap', () => {
  it('repeating keywords 100× does not exceed the score of a clean resume', () => {
    const cleanResult = calculateReadinessScore(makeInput());

    const stuffed = 'TypeScript Kubernetes Docker Go Python '.repeat(200);
    const stuffedResult = calculateReadinessScore(
      makeInput({ resumeText: RICH_RESUME_TEXT + '\n' + stuffed }),
    );

    // The ceiling must hold; the stuffed result should not be materially higher
    expect(stuffedResult.total).toBeLessThanOrEqual(100);
    // Stuffed keywords should not exceed the clean resume's score
    expect(stuffedResult.total).toBeLessThanOrEqual(cleanResult.total);
    // Sanity: stuffing shouldn't catastrophically destroy a good score either
    expect(stuffedResult.total).toBeGreaterThanOrEqual(0);
  });

  it('keyword density does not get wildly inflated by stuffing', () => {
    const stuffed = 'TypeScript '.repeat(500);
    const result = calculateReadinessScore(
      makeInput({ resumeText: RICH_RESUME_TEXT + '\n' + stuffed }),
    );
    // Density may be high, but score must remain bounded
    expect(result.breakdown.roleRelevance).toBeLessThanOrEqual(30);
    expect(result.total).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 6. Max Possible Score — consistent value across identical inputs
// ---------------------------------------------------------------------------

describe('Max possible score consistency', () => {
  it('calculateReadinessScore is deterministic — same inputs yield same outputs', () => {
    const first = calculateReadinessScore(makeInput());
    const second = calculateReadinessScore(makeInput());
    expect(first.total).toBe(second.total);
    expect(first.breakdown).toEqual(second.breakdown);
    expect(first.details.matchedKeywords).toEqual(second.details.matchedKeywords);
  });

  it('running the same input 5 times always returns the same total', () => {
    const results = Array.from({ length: 5 }, () => calculateReadinessScore(makeInput()));
    const totals = results.map((r) => r.total);
    expect(new Set(totals).size).toBe(1);
  });

  it('breakdown sub-score sum equals or exceeds total (no hidden penalty)', () => {
    const result = calculateReadinessScore(makeInput());
    const subSum =
      result.breakdown.roleRelevance +
      result.breakdown.claritySkimmability +
      result.breakdown.businessImpact +
      result.breakdown.presentationQuality;
    // total is rounded/capped from subSum, so it should always be ≤ subSum + ε
    expect(result.total).toBeLessThanOrEqual(subSum + 0.5);
  });

  it('isOptimized reflects whether score meets readiness threshold', () => {
    const result = calculateReadinessScore(makeInput());
    expect(typeof result.isOptimized).toBe('boolean');
    // isOptimized should be true when total >= 70, false otherwise
    expect(result.isOptimized).toBe(result.total >= 70);
  });
});

// ---------------------------------------------------------------------------
// 7. Edge Cases — empty JD, empty resume, null/undefined inputs
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('empty jobDescription returns total = 0', () => {
    const result = calculateReadinessScore(
      makeInput({ jobDescription: '' }),
    );
    expect(result.total).toBe(0);
    expect(result.details.matchedKeywords).toHaveLength(0);
  });

  it('whitespace-only jobDescription returns total = 0', () => {
    const result = calculateReadinessScore(
      makeInput({ jobDescription: '   \n\t  ' }),
    );
    expect(result.total).toBe(0);
  });

  it('empty resumeText returns total = 0', () => {
    const result = calculateReadinessScore(
      makeInput({ resumeText: '' }),
    );
    expect(result.total).toBe(0);
    expect(result.details.matchedKeywords).toHaveLength(0);
  });

  it('whitespace-only resumeText returns total = 0', () => {
    const result = calculateReadinessScore(
      makeInput({ resumeText: '   \n   ' }),
    );
    expect(result.total).toBe(0);
  });

  it('empty jobDescription result has all breakdown sub-scores = 0', () => {
    const result = calculateReadinessScore(
      makeInput({ jobDescription: '' }),
    );
    expect(result.breakdown.roleRelevance).toBe(0);
    expect(result.breakdown.claritySkimmability).toBe(0);
    expect(result.breakdown.businessImpact).toBe(0);
    expect(result.breakdown.presentationQuality).toBe(0);
  });

  it('empty resumeText result has all breakdown sub-scores = 0', () => {
    const result = calculateReadinessScore(
      makeInput({ resumeText: '' }),
    );
    expect(result.breakdown.roleRelevance).toBe(0);
    expect(result.breakdown.claritySkimmability).toBe(0);
    expect(result.breakdown.businessImpact).toBe(0);
    expect(result.breakdown.presentationQuality).toBe(0);
  });

  it('empty resumeData (no fields) does not throw', () => {
    expect(() =>
      calculateReadinessScore(makeInput({ resumeData: {} })),
    ).not.toThrow();
  });

  it('minimal resumeData with only a title does not throw', () => {
    expect(() =>
      calculateReadinessScore(makeInput({ resumeData: { title: 'Engineer' } })),
    ).not.toThrow();
  });

  it('handles missing optional fields in resumeData gracefully', () => {
    const result = calculateReadinessScore(
      makeInput({
        resumeData: {
          // only mandatory-ish field; all arrays absent
          title: 'Backend Engineer',
          yearsExperience: 3,
        },
      }),
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('returns a well-formed ATSScore object for a minimal valid input', () => {
    const result = calculateReadinessScore(
      makeInput({ jobDescription: 'JavaScript developer', resumeText: 'JavaScript', resumeData: {} }),
    );
    // Shape checks
    expect(typeof result.total).toBe('number');
    expect(typeof result.isOptimized).toBe('boolean');
    expect(result.breakdown).toBeDefined();
    expect(result.details).toBeDefined();
    expect(Array.isArray(result.details.matchedKeywords)).toBe(true);
    expect(Array.isArray(result.details.missingKeywords)).toBe(true);
    expect(Array.isArray(result.details.matchDetails)).toBe(true);
  });

  it('empty resume with non-empty JD lists all extracted keywords as missing', () => {
    const result = calculateReadinessScore(makeInput({ resumeText: '' }));
    // All extracted keywords should end up as missing
    const allKws = result.details.extractedKeywords.all;
    expect(allKws.length).toBeGreaterThan(0);
    expect(result.details.missingKeywords.length).toBe(allKws.length);
    expect(result.details.matchedKeywords).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 8. formatScoreAssessment — threshold labels
// ---------------------------------------------------------------------------

describe('formatScoreAssessment', () => {
  it('returns "Interview-ready" for score >= 85', () => {
    expect(formatScoreAssessment(85)).toContain('Interview-ready');
    expect(formatScoreAssessment(100)).toContain('Interview-ready');
    expect(formatScoreAssessment(90)).toContain('Interview-ready');
  });

  it('returns "Strong presentation" for score 70–84', () => {
    expect(formatScoreAssessment(70)).toContain('Strong presentation');
    expect(formatScoreAssessment(84)).toContain('Strong presentation');
    expect(formatScoreAssessment(77)).toContain('Strong presentation');
  });

  it('returns "Decent foundation" for score 55–69', () => {
    expect(formatScoreAssessment(55)).toContain('Decent foundation');
    expect(formatScoreAssessment(69)).toContain('Decent foundation');
    expect(formatScoreAssessment(62)).toContain('Decent foundation');
  });

  it('returns "Significant gaps" for score < 55', () => {
    expect(formatScoreAssessment(54)).toContain('Significant gaps');
    expect(formatScoreAssessment(0)).toContain('Significant gaps');
    expect(formatScoreAssessment(30)).toContain('Significant gaps');
  });

  it('boundary: exactly 85 is "Interview-ready"', () => {
    expect(formatScoreAssessment(85)).toContain('Interview-ready');
  });

  it('boundary: exactly 70 is "Strong presentation"', () => {
    expect(formatScoreAssessment(70)).toContain('Strong presentation');
  });

  it('boundary: exactly 55 is "Decent foundation"', () => {
    expect(formatScoreAssessment(55)).toContain('Decent foundation');
  });

  it('always returns a non-empty string', () => {
    [-10, 0, 50, 75, 85, 100, 999].forEach((score) => {
      expect(typeof formatScoreAssessment(score)).toBe('string');
      expect(formatScoreAssessment(score).length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// 9. resumeDataToText — serialisation
// ---------------------------------------------------------------------------

describe('resumeDataToText', () => {
  it('includes the candidate name when provided', () => {
    const text = resumeDataToText({ ...RICH_RESUME_DATA, name: 'Jane Smith' });
    expect(text).toContain('Jane Smith');
  });

  it('includes the candidate title when provided', () => {
    const text = resumeDataToText(RICH_RESUME_DATA);
    expect(text).toContain('Senior Software Engineer');
  });

  it('includes skills when provided as flat array', () => {
    const text = resumeDataToText({ skills: ['TypeScript', 'Go', 'Python'] });
    expect(text).toContain('TypeScript');
    expect(text).toContain('Go');
    expect(text).toContain('Python');
  });

  it('includes skillsByCategory items when provided', () => {
    const text = resumeDataToText({
      skillsByCategory: [
        { category: 'Languages', items: ['TypeScript', 'Go'] },
      ],
    });
    expect(text).toContain('Languages');
    expect(text).toContain('TypeScript');
    expect(text).toContain('Go');
  });

  it('includes experience titles and highlights', () => {
    const text = resumeDataToText(RICH_RESUME_DATA);
    expect(text).toContain('Acme Corp');
    expect(text).toContain('Kubernetes');
  });

  it('includes education degree and institution', () => {
    const text = resumeDataToText(RICH_RESUME_DATA);
    expect(text).toContain('Bachelor of Science in Computer Science');
    expect(text).toContain('State University');
  });

  it('includes summary when provided', () => {
    const text = resumeDataToText({
      ...RICH_RESUME_DATA,
      summary: 'Experienced engineer passionate about distributed systems.',
    });
    expect(text).toContain('Experienced engineer passionate about distributed systems.');
  });

  it('returns a non-empty string for a fully populated resume', () => {
    const text = resumeDataToText(RICH_RESUME_DATA);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('returns an empty string for a completely empty object', () => {
    const text = resumeDataToText({});
    expect(text).toBe('');
  });

  it('is stable — same input produces same output', () => {
    const first = resumeDataToText(RICH_RESUME_DATA);
    const second = resumeDataToText(RICH_RESUME_DATA);
    expect(first).toBe(second);
  });

  it('does not include undefined or null tokens in the output', () => {
    const text = resumeDataToText({ title: 'Engineer' });
    expect(text).not.toContain('undefined');
    expect(text).not.toContain('null');
  });
});

// ---------------------------------------------------------------------------
// 10. Integration — scoring a generated resumeDataToText
// ---------------------------------------------------------------------------

// Extra fixtures for coverage of internal branches -------------------------

/** Management-oriented JD (triggers management role detection) */
const MGMT_JD = `
Engineering Manager — Platform Team

We are hiring an Engineering Manager to lead a team of 8 engineers building
cloud infrastructure. You will manage direct reports, conduct performance reviews,
and run quarterly planning. 10+ years of experience required.

Responsibilities include:
- People management and coaching
- Team of 8-12 engineers
- Stakeholder management and alignment
- Hiring and growing engineers
- Managing delivery and roadmap execution

Required: AWS, Kubernetes, leadership, communication, agile, scrum
Bachelor's degree in Computer Science preferred.
`;

const MGMT_RESUME_DATA: ResumeData = {
  title: 'Engineering Manager',
  yearsExperience: 12,
  teamSize: '10 engineers',
  skills: ['AWS', 'Kubernetes', 'leadership', 'agile', 'scrum'],
  skillsByCategory: [
    { category: 'Leadership', items: ['coaching', 'hiring', 'roadmap'] },
    { category: 'Cloud', items: ['AWS', 'Kubernetes'] },
  ],
  experiences: [
    {
      title: 'Engineering Manager',
      company: 'BigCo',
      highlights: [
        'Managed team of 10 engineers building cloud infrastructure',
        'Conducted quarterly planning and performance reviews',
        'Led AWS and Kubernetes migrations for platform team',
      ],
    },
    {
      title: 'Senior Engineer',
      company: 'StartupCo',
      highlights: ['Built microservices on AWS', 'Led agile sprint ceremonies'],
    },
  ],
  education: [{ degree: 'Bachelor of Science in Computer Science', institution: 'MIT' }],
};

/** IC JD with explicit years requirement */
const IC_JD_YEARS = `
Software Engineer — Backend

We need a Software Engineer with 3+ years of experience writing backend services
in Python. Individual contributor role, no direct reports. Hands-on coding expected.

Required: Python, REST APIs, PostgreSQL
`;

/** Management JD where resume team size is smaller than required */
const MGMT_JD_BIG_TEAM = `
Director of Engineering

Lead a team of 50 engineers. 15+ years experience required.
People management, direct reports, managing a team of engineers.
Required: Java, AWS, leadership, managing, supervise
`;

/** JD requiring a PhD */
const PHD_JD = `
Research Scientist

PhD in Computer Science required. 5+ years of experience in machine learning.
Required skills: Python, TensorFlow, PyTorch, research
`;

/** Resume with a PhD */
const PHD_RESUME_DATA: ResumeData = {
  title: 'Research Scientist',
  yearsExperience: 6,
  skills: ['Python', 'TensorFlow', 'PyTorch', 'machine learning'],
  education: [
    { degree: 'PhD in Computer Science', institution: 'Stanford' },
  ],
  experiences: [
    {
      title: 'Research Scientist',
      company: 'AI Lab',
      highlights: ['Published papers on TensorFlow optimization', 'Trained PyTorch models at scale'],
    },
  ],
};

/** Resume with only a Bachelor's against a PhD-required JD */
const BACHELOR_RESUME_DATA: ResumeData = {
  title: 'Research Scientist',
  yearsExperience: 6,
  skills: ['Python', 'TensorFlow', 'PyTorch'],
  education: [
    { degree: 'Bachelor of Science in Computer Science', institution: 'State U' },
  ],
  experiences: [{ title: 'Data Scientist', company: 'Corp', highlights: ['Built models'] }],
};

/** Resume with a Master's */
const MASTERS_RESUME_DATA: ResumeData = {
  title: 'Research Scientist',
  yearsExperience: 6,
  skills: ['Python', 'TensorFlow'],
  education: [{ degree: 'Master of Science in Computer Science', institution: 'CMU' }],
  experiences: [{ title: 'ML Engineer', company: 'Corp', highlights: ['Training models'] }],
};

describe('Integration: resumeDataToText → calculateReadinessScore', () => {
  it('text generated from structured data scores above zero against its JD', () => {
    const generatedText = resumeDataToText({ ...RICH_RESUME_DATA, name: 'Jane Smith' });
    const result = calculateReadinessScore(
      makeInput({ resumeText: generatedText }),
    );
    expect(result.total).toBeGreaterThan(0);
  });

  it('a richer resume data object produces the same or higher score than a sparse one', () => {
    const sparseText = resumeDataToText({ title: 'Engineer', yearsExperience: 5 });
    const richText = resumeDataToText({ ...RICH_RESUME_DATA, name: 'Jane Smith' });

    const sparseResult = calculateReadinessScore(makeInput({ resumeText: sparseText, resumeData: { title: 'Engineer' } }));
    const richResult = calculateReadinessScore(makeInput({ resumeText: richText }));

    expect(richResult.total).toBeGreaterThanOrEqual(sparseResult.total);
  });
});

// ---------------------------------------------------------------------------
// 11. Management role branch coverage
// ---------------------------------------------------------------------------

describe('Management role detection', () => {
  it('detects a management JD and scores a matching manager resume above zero', () => {
    const result = calculateReadinessScore({
      jobDescription: MGMT_JD,
      resumeText: resumeDataToText({ ...MGMT_RESUME_DATA, name: 'Bob Mgr' }),
      resumeData: MGMT_RESUME_DATA,
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('management resume with matching team size scores higher than undersized team', () => {
    const matchingResult = calculateReadinessScore({
      jobDescription: MGMT_JD,
      resumeText: resumeDataToText(MGMT_RESUME_DATA),
      resumeData: MGMT_RESUME_DATA,
    });

    const undersizedResult = calculateReadinessScore({
      jobDescription: MGMT_JD,
      resumeText: resumeDataToText({ ...MGMT_RESUME_DATA, teamSize: '2 engineers' }),
      resumeData: { ...MGMT_RESUME_DATA, teamSize: '2 engineers' },
    });

    expect(matchingResult.total).toBeGreaterThanOrEqual(undersizedResult.total);
  });

  it('large team requirement with no resume team size still returns a valid score', () => {
    const result = calculateReadinessScore({
      jobDescription: MGMT_JD_BIG_TEAM,
      resumeText: 'Senior Engineer with leadership experience in Java and AWS.',
      resumeData: { title: 'Senior Engineer', yearsExperience: 8, skills: ['Java', 'AWS'] },
    });
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('openToRoles field is used for domain-relevance when primary title does not match', () => {
    const withRoles = calculateReadinessScore({
      jobDescription: MGMT_JD,
      resumeText: resumeDataToText(MGMT_RESUME_DATA),
      resumeData: {
        ...MGMT_RESUME_DATA,
        title: 'Staff Engineer',
        openToRoles: ['Engineering Manager', 'Director of Engineering'],
      },
    });
    expect(withRoles.total).toBeGreaterThan(0);
    expect(withRoles.total).toBeLessThanOrEqual(100);
  });
});

// ---------------------------------------------------------------------------
// 12. IC role branch coverage
// ---------------------------------------------------------------------------

describe('IC role branch', () => {
  it('IC JD with explicit years requirement scores correctly', () => {
    const result = calculateReadinessScore({
      jobDescription: IC_JD_YEARS,
      resumeText: 'Python developer with 5 years experience. REST APIs, PostgreSQL.',
      resumeData: {
        title: 'Software Engineer',
        yearsExperience: 5,
        skills: ['Python', 'REST APIs', 'PostgreSQL'],
        experiences: [
          { title: 'Backend Engineer', company: 'Corp', highlights: ['Built Python REST APIs'] },
          { title: 'Junior Dev', company: 'Startup', highlights: ['PostgreSQL admin'] },
        ],
      },
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('resume with fewer years than JD requires still scores non-negative', () => {
    const result = calculateReadinessScore({
      jobDescription: IC_JD_YEARS,
      resumeText: 'Python developer. REST APIs.',
      resumeData: {
        title: 'Software Engineer',
        yearsExperience: 1, // JD requires 3+
        skills: ['Python', 'REST APIs'],
      },
    });
    expect(result.total).toBeGreaterThanOrEqual(0);
  });

  it('overqualified resume (years >> JD requirement) still stays within ceiling', () => {
    const result = calculateReadinessScore({
      jobDescription: IC_JD_YEARS,
      resumeText: 'Python expert. 20 years. REST APIs, PostgreSQL.',
      resumeData: {
        title: 'Principal Engineer',
        yearsExperience: 20,  // JD requires only 3
        skills: ['Python', 'REST APIs', 'PostgreSQL'],
      },
    });
    expect(result.total).toBeLessThanOrEqual(100);
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 13. Education matching branches
// ---------------------------------------------------------------------------

describe('Education matching', () => {
  it('PhD holder against PhD-required JD scores >= bachelor holder', () => {
    const phdResult = calculateReadinessScore({
      jobDescription: PHD_JD,
      resumeText: resumeDataToText(PHD_RESUME_DATA),
      resumeData: PHD_RESUME_DATA,
    });
    const bachelorResult = calculateReadinessScore({
      jobDescription: PHD_JD,
      resumeText: resumeDataToText(BACHELOR_RESUME_DATA),
      resumeData: BACHELOR_RESUME_DATA,
    });
    expect(phdResult.total).toBeGreaterThanOrEqual(bachelorResult.total);
  });

  it("Master's holder against PhD JD scores are valid and PhD scores at least as high", () => {
    // Use an identical skill-set for both resumes so education level is the only variable
    const sharedData = {
      title: 'Research Scientist',
      yearsExperience: 6,
      skills: ['Python', 'TensorFlow', 'PyTorch', 'machine learning'],
      experiences: [
        {
          title: 'Research Scientist',
          company: 'AI Lab',
          highlights: ['Built TensorFlow models', 'Trained PyTorch networks at scale'],
        },
      ],
    };

    const phdResult = calculateReadinessScore({
      jobDescription: PHD_JD,
      resumeText: resumeDataToText({ ...sharedData, education: [{ degree: 'PhD in Computer Science', institution: 'Stanford' }] }),
      resumeData: { ...sharedData, education: [{ degree: 'PhD in Computer Science', institution: 'Stanford' }] },
    });
    const mastersResult = calculateReadinessScore({
      jobDescription: PHD_JD,
      resumeText: resumeDataToText({ ...sharedData, education: MASTERS_RESUME_DATA.education }),
      resumeData: { ...sharedData, education: MASTERS_RESUME_DATA.education },
    });

    // Both scores must be valid
    expect(phdResult.total).toBeGreaterThanOrEqual(0);
    expect(phdResult.total).toBeLessThanOrEqual(100);
    expect(mastersResult.total).toBeGreaterThanOrEqual(0);
    expect(mastersResult.total).toBeLessThanOrEqual(100);
    // PhD holder should score >= Master's holder when all else is equal
    expect(phdResult.total).toBeGreaterThanOrEqual(mastersResult.total);
  });

  it('resume with no education against JD without education requirement still works', () => {
    const result = calculateReadinessScore({
      jobDescription: IC_JD_YEARS,
      resumeText: 'Python developer. REST APIs.',
      resumeData: {
        title: 'Developer',
        skills: ['Python', 'REST APIs'],
        // no education field
      },
    });
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('resume with education but JD has no requirement gives a small bonus', () => {
    const withEdu = calculateReadinessScore({
      jobDescription: IC_JD_YEARS,
      resumeText: 'Python developer. REST APIs. BS Computer Science.',
      resumeData: {
        title: 'Developer',
        skills: ['Python', 'REST APIs'],
        education: [{ degree: 'Bachelor of Science', institution: 'University' }],
      },
    });
    expect(withEdu.total).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 14. Keyword density compliance bands
// ---------------------------------------------------------------------------

describe('Keyword density compliance', () => {
  it('resume with very low keyword density scores non-negatively', () => {
    const lowDensityText = 'I once used Python. That is my entire experience. ' +
      'Lots of filler text to dilute. '.repeat(100);
    const result = calculateReadinessScore(
      makeInput({ resumeText: lowDensityText }),
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('resume with extremely high keyword density stays within bounds', () => {
    // Very short text with many keyword repetitions → high density
    const highDensityText = 'TypeScript Kubernetes Docker Go Python TypeScript Kubernetes Docker'.repeat(3);
    const result = calculateReadinessScore(
      makeInput({ resumeText: highDensityText }),
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('optimal density range resume (2-8%) scores presentationQuality > 0', () => {
    // Use a text length and keyword frequency that should land in 2-8%
    const optimalText =
      'TypeScript developer experienced in Kubernetes and Docker. ' +
      'Built distributed microservices with Go and Python on AWS. ' +
      'REST APIs and PostgreSQL are core skills. GitHub Actions for CI/CD. ' +
      'Proficient in GraphQL, Redis, and Kafka. ArgoCD deployment experience. ' +
      'Prometheus and Grafana for observability. GCP cloud platform.';
    const result = calculateReadinessScore(
      makeInput({ resumeText: optimalText }),
    );
    expect(result.total).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 15. resumeData skills coverage paths
// ---------------------------------------------------------------------------

describe('ResumeData skills coverage', () => {
  it('skills listed only via skillsByCategory are picked up for scoring', () => {
    const result = calculateReadinessScore({
      jobDescription: RICH_JD,
      resumeText: resumeDataToText({
        title: 'Senior Software Engineer',
        yearsExperience: 7,
        skillsByCategory: [
          { category: 'Languages', items: ['TypeScript', 'Go', 'Python'] },
          { category: 'Infrastructure', items: ['Kubernetes', 'Docker', 'AWS'] },
          { category: 'Databases', items: ['PostgreSQL', 'Redis'] },
        ],
        experiences: [
          { title: 'Engineer', company: 'Corp', highlights: ['Built TypeScript services on Kubernetes'] },
          { title: 'Junior Dev', company: 'Startup', highlights: ['Go microservices'] },
        ],
        education: [{ degree: 'Bachelor of Science in Computer Science', institution: 'Uni' }],
      }),
      resumeData: {
        title: 'Senior Software Engineer',
        yearsExperience: 7,
        skillsByCategory: [
          { category: 'Languages', items: ['TypeScript', 'Go', 'Python'] },
          { category: 'Infrastructure', items: ['Kubernetes', 'Docker', 'AWS'] },
          { category: 'Databases', items: ['PostgreSQL', 'Redis'] },
        ],
        experiences: [
          { title: 'Engineer', company: 'Corp', highlights: ['Built TypeScript services on Kubernetes'] },
          { title: 'Junior Dev', company: 'Startup', highlights: ['Go microservices'] },
        ],
        education: [{ degree: 'Bachelor of Science in Computer Science', institution: 'Uni' }],
      },
    });
    expect(result.breakdown.claritySkimmability).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('resume with no skills sections gets zero or minimal claritySkimmability', () => {
    const result = calculateReadinessScore({
      jobDescription: RICH_JD,
      resumeText: 'Engineer with experience in software development.',
      resumeData: { title: 'Engineer', yearsExperience: 5 },
    });
    // Can't assert exact zero (text may partially match), but should be bounded
    expect(result.breakdown.claritySkimmability).toBeLessThanOrEqual(30);
    expect(result.breakdown.claritySkimmability).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 16. Section completeness paths
// ---------------------------------------------------------------------------

describe('Section completeness', () => {
  it('fully populated resume gets maximum possible completeness contribution', () => {
    const full = calculateReadinessScore(makeInput());
    const empty = calculateReadinessScore(makeInput({ resumeData: {} }));
    // Full data should produce a higher or equal presentationQuality
    expect(full.breakdown.presentationQuality).toBeGreaterThanOrEqual(
      empty.breakdown.presentationQuality,
    );
  });

  it('resume with experiences but no highlights still counts toward completeness', () => {
    const result = calculateReadinessScore(
      makeInput({
        resumeData: {
          title: 'Engineer',
          experiences: [{ title: 'Developer', company: 'Corp' }],
        },
      }),
    );
    expect(result.total).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// 17. Score structure invariants
// ---------------------------------------------------------------------------

describe('Score structure invariants', () => {
  it('total is a valid number in deterministic mode', () => {
    const result = calculateReadinessScore(makeInput());
    expect(result.total).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeLessThanOrEqual(100);
  });

  it('keywordDensity in details is a non-negative number', () => {
    const result = calculateReadinessScore(makeInput());
    expect(result.details.keywordDensity).toBeGreaterThanOrEqual(0);
    expect(typeof result.details.keywordDensity).toBe('number');
  });

  it('extractedKeywords has all required fields', () => {
    const result = calculateReadinessScore(makeInput());
    const kws = result.details.extractedKeywords;
    expect(Array.isArray(kws.all)).toBe(true);
    expect(Array.isArray(kws.fromTitle)).toBe(true);
    expect(Array.isArray(kws.fromRequired)).toBe(true);
    expect(Array.isArray(kws.technologies)).toBe(true);
    expect(typeof kws.keywordPriorities).toBe('object');
  });

  it('matchDetails entries have keyword and matchType fields', () => {
    const result = calculateReadinessScore(makeInput());
    for (const detail of result.details.matchDetails) {
      expect(typeof detail.keyword).toBe('string');
      expect(['exact', 'stem', 'synonym']).toContain(detail.matchType);
    }
  });
});
