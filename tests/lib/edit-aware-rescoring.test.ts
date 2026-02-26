import { describe, it, expect } from 'vitest';
import type { ProposedChange, ResumeAnalysisResult, ScoreCeiling } from '@/lib/types/resume-generation';
import { calculateEditedImpact, normalizeImpactPoints } from '@/lib/resume-scoring';

describe('calculateEditedImpact', () => {
  describe('with impactPerKeyword provided', () => {
    it('returns full impact when all keywords are retained', () => {
      const change: ProposedChange = {
        section: 'summary',
        original: 'Original text',
        modified: 'Platform engineering leader with cloud infrastructure expertise',
        reason: 'Added keywords',
        keywordsAdded: ['platform engineering', 'cloud infrastructure'],
        impactPoints: 4,
        impactPerKeyword: 2,
      };

      const editedText = 'Platform engineering leader with cloud infrastructure expertise';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(4); // 2 keywords * 2 points each
    });

    it('returns partial impact when some keywords are removed', () => {
      const change: ProposedChange = {
        section: 'summary',
        original: 'Original text',
        modified: 'Platform engineering leader with cloud infrastructure expertise',
        reason: 'Added keywords',
        keywordsAdded: ['platform engineering', 'cloud infrastructure'],
        impactPoints: 4,
        impactPerKeyword: 2,
      };

      // Removed 'cloud infrastructure'
      const editedText = 'Platform engineering leader with technical expertise';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(2); // 1 keyword * 2 points
    });

    it('returns zero when all keywords are removed', () => {
      const change: ProposedChange = {
        section: 'summary',
        original: 'Original text',
        modified: 'Platform engineering leader with cloud infrastructure expertise',
        reason: 'Added keywords',
        keywordsAdded: ['platform engineering', 'cloud infrastructure'],
        impactPoints: 4,
        impactPerKeyword: 2,
      };

      const editedText = 'Technology leader with deep technical expertise';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(0); // 0 keywords retained
    });

    it('handles fractional impactPerKeyword correctly', () => {
      const change: ProposedChange = {
        section: 'skills.cloud',
        original: 'GCP, AWS',
        modified: 'Google Cloud Platform (GCP), AWS, Kubernetes, Terraform, Docker',
        reason: 'Expanded skills',
        keywordsAdded: ['kubernetes', 'terraform', 'docker', 'helm', 'istio'],
        impactPoints: 8,
        impactPerKeyword: 1.6,
      };

      // Keep only kubernetes and terraform
      const editedText = 'GCP, AWS, Kubernetes, Terraform';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(3); // Math.round(2 * 1.6) = 3
    });
  });

  describe('without impactPerKeyword (fallback calculation)', () => {
    it('calculates impactPerKeyword from impactPoints / keywordsAdded.length', () => {
      const change: ProposedChange = {
        section: 'summary',
        original: 'Original text',
        modified: 'Platform engineering leader with cloud infrastructure expertise',
        reason: 'Added keywords',
        keywordsAdded: ['platform engineering', 'cloud infrastructure'],
        impactPoints: 4,
        // No impactPerKeyword provided
      };

      const editedText = 'Platform engineering leader with technical expertise';
      const impact = calculateEditedImpact(change, editedText);

      // Fallback: 4 / 2 = 2 points per keyword, 1 keyword retained = 2 points
      expect(impact).toBe(2);
    });

    it('returns full impact when all keywords retained (fallback)', () => {
      const change: ProposedChange = {
        section: 'experience.verily.bullet1',
        original: 'Led teams',
        modified: 'Led cross-functional engineering teams',
        reason: 'Added keywords',
        keywordsAdded: ['led', 'cross-functional', 'engineering'],
        impactPoints: 6,
      };

      const editedText = 'Led cross-functional engineering teams delivering results';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(6); // All 3 keywords, 2 pts each
    });
  });

  describe('edge cases', () => {
    it('returns full impact when keywordsAdded is empty', () => {
      const change: ProposedChange = {
        section: 'summary',
        original: 'Original text',
        modified: 'Improved text',
        reason: 'Better phrasing',
        keywordsAdded: [],
        impactPoints: 3,
      };

      const editedText = 'Any text here';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(3); // Full impact since no keywords to check
    });

    it('handles case-insensitive keyword matching', () => {
      const change: ProposedChange = {
        section: 'skills',
        original: 'Skills',
        modified: 'Kubernetes, AWS, GCP',
        reason: 'Added cloud skills',
        keywordsAdded: ['Kubernetes', 'AWS'],
        impactPoints: 4,
        impactPerKeyword: 2,
      };

      // Keywords in different case
      const editedText = 'kubernetes, aws, Azure';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(4); // Both keywords found (case insensitive)
    });

    it('handles keywords with special characters', () => {
      const change: ProposedChange = {
        section: 'experience',
        original: 'Built platform',
        modified: 'Built CI/CD platform with 99.9% uptime',
        reason: 'Added specifics',
        keywordsAdded: ['CI/CD', '99.9%'],
        impactPoints: 4,
        impactPerKeyword: 2,
      };

      const editedText = 'Built CI/CD platform with high availability';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(2); // Only CI/CD retained
    });

    it('handles partial keyword matches correctly', () => {
      const change: ProposedChange = {
        section: 'skills',
        original: 'Skills',
        modified: 'JavaScript, TypeScript, React',
        reason: 'Added frontend skills',
        keywordsAdded: ['JavaScript', 'TypeScript'],
        impactPoints: 4,
        impactPerKeyword: 2,
      };

      // "Script" alone should NOT match "JavaScript" or "TypeScript"
      const editedText = 'Script language experience';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(0); // Neither keyword fully matches
    });

    it('uses word boundaries for single-token keywords', () => {
      const change: ProposedChange = {
        section: 'skills',
        original: 'Skills',
        modified: 'C, Python',
        reason: 'Added language keyword',
        keywordsAdded: ['c'],
        impactPoints: 2,
        impactPerKeyword: 2,
      };

      const editedText = 'Experienced in cloud platforms';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(0);
    });

    it('handles punctuation-heavy keywords without substring false positives', () => {
      const change: ProposedChange = {
        section: 'skills',
        original: 'Skills',
        modified: 'C++, Python',
        reason: 'Added language keyword',
        keywordsAdded: ['c++'],
        impactPoints: 2,
        impactPerKeyword: 2,
      };

      const editedText = 'Experienced in C+ migration projects';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(0);
    });

    it('handles single keyword change', () => {
      const change: ProposedChange = {
        section: 'experience.verily.bullet1',
        original: 'Managed cloud migration',
        modified: 'Led cloud migration',
        reason: 'Changed verb to match JD',
        keywordsAdded: ['led'],
        impactPoints: 2,
        impactPerKeyword: 2,
      };

      const editedText = 'Led the cloud migration project';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(2);
    });

    it('handles single keyword removed', () => {
      const change: ProposedChange = {
        section: 'experience.verily.bullet1',
        original: 'Managed cloud migration',
        modified: 'Led cloud migration',
        reason: 'Changed verb to match JD',
        keywordsAdded: ['led'],
        impactPoints: 2,
        impactPerKeyword: 2,
      };

      // Changed back to "managed"
      const editedText = 'Managed the cloud migration project';
      const impact = calculateEditedImpact(change, editedText);

      expect(impact).toBe(0);
    });

    it('rounds fractional results correctly', () => {
      const change: ProposedChange = {
        section: 'skills',
        original: 'Skills',
        modified: 'Added 5 skills',
        reason: 'More skills',
        keywordsAdded: ['skill1', 'skill2', 'skill3'],
        impactPoints: 5, // 5/3 = 1.67 per keyword
      };

      // Keep 2 of 3 keywords
      const editedText = 'skill1 and skill2 are here';
      const impact = calculateEditedImpact(change, editedText);

      // 2 * 1.67 = 3.33, rounds to 3
      expect(impact).toBe(3);
    });
  });
});

describe('projected score calculation', () => {
  /**
   * Simulates the projected score calculation from the page.
   */
  function calculateProjectedScore(
    baseScore: number,
    changes: ProposedChange[],
    acceptedIndices: Set<number>,
    editedTexts: Map<number, string>
  ): number {
    let score = baseScore;

    for (const [index, change] of changes.entries()) {
      if (!acceptedIndices.has(index)) continue;

      const editedText = editedTexts.get(index);
      if (editedText) {
        score += calculateEditedImpact(change, editedText);
      } else {
        score += change.impactPoints;
      }
    }

    return Math.min(100, Math.round(score));
  }

  it('calculates correct score with no edits', () => {
    const changes: ProposedChange[] = [
      {
        section: 'summary',
        original: 'Old',
        modified: 'New with keyword1',
        reason: 'Test',
        keywordsAdded: ['keyword1'],
        impactPoints: 3,
      },
      {
        section: 'skills',
        original: 'Old skills',
        modified: 'New skills with keyword2',
        reason: 'Test',
        keywordsAdded: ['keyword2'],
        impactPoints: 5,
      },
    ];

    const acceptedIndices = new Set([0, 1]);
    const editedTexts = new Map<number, string>();

    const score = calculateProjectedScore(72, changes, acceptedIndices, editedTexts);

    expect(score).toBe(80); // 72 + 3 + 5
  });

  it('calculates correct score with partial acceptance', () => {
    const changes: ProposedChange[] = [
      {
        section: 'summary',
        original: 'Old',
        modified: 'New',
        reason: 'Test',
        keywordsAdded: ['keyword1'],
        impactPoints: 3,
      },
      {
        section: 'skills',
        original: 'Old',
        modified: 'New',
        reason: 'Test',
        keywordsAdded: ['keyword2'],
        impactPoints: 5,
      },
    ];

    const acceptedIndices = new Set([0]); // Only first change
    const editedTexts = new Map<number, string>();

    const score = calculateProjectedScore(72, changes, acceptedIndices, editedTexts);

    expect(score).toBe(75); // 72 + 3
  });

  it('calculates reduced score when edits remove keywords', () => {
    const changes: ProposedChange[] = [
      {
        section: 'summary',
        original: 'Old',
        modified: 'New with keyword1 and keyword2',
        reason: 'Test',
        keywordsAdded: ['keyword1', 'keyword2'],
        impactPoints: 6,
        impactPerKeyword: 3,
      },
    ];

    const acceptedIndices = new Set([0]);
    const editedTexts = new Map([[0, 'New with keyword1 only']]); // Removed keyword2

    const score = calculateProjectedScore(72, changes, acceptedIndices, editedTexts);

    expect(score).toBe(75); // 72 + 3 (only 1 keyword retained)
  });

  it('caps score at 100', () => {
    const changes: ProposedChange[] = [
      {
        section: 'summary',
        original: 'Old',
        modified: 'New',
        reason: 'Test',
        keywordsAdded: ['keyword1'],
        impactPoints: 50,
      },
    ];

    const acceptedIndices = new Set([0]);
    const editedTexts = new Map<number, string>();

    const score = calculateProjectedScore(72, changes, acceptedIndices, editedTexts);

    expect(score).toBe(100); // Capped at 100
  });

  it('handles empty acceptance', () => {
    const changes: ProposedChange[] = [
      {
        section: 'summary',
        original: 'Old',
        modified: 'New',
        reason: 'Test',
        keywordsAdded: ['keyword1'],
        impactPoints: 5,
      },
    ];

    const acceptedIndices = new Set<number>(); // Nothing accepted
    const editedTexts = new Map<number, string>();

    const score = calculateProjectedScore(72, changes, acceptedIndices, editedTexts);

    expect(score).toBe(72); // No change
  });
});

/** Helper to create a minimal ResumeAnalysisResult for testing */
function makeResult(
  currentTotal: number,
  optimizedTotal: number,
  changes: ProposedChange[],
  scoreCeiling?: ScoreCeiling
): ResumeAnalysisResult {
  return {
    analysis: {
      jdSummary: 'Test',
      companyName: 'Test Co',
      roleTitle: 'Engineer',
      topKeywords: [],
      requiredSkills: [],
      niceToHaveSkills: [],
      yearsRequired: '5+',
    },
    currentScore: {
      total: currentTotal,
      breakdown: { keywordRelevance: 20, skillsQuality: 15, experienceAlignment: 10, contentQuality: 8 },
      assessment: 'Test',
    },
    proposedChanges: changes,
    optimizedScore: {
      total: optimizedTotal,
      breakdown: { keywordRelevance: 30, skillsQuality: 20, experienceAlignment: 15, contentQuality: 8 },
      assessment: 'Test',
    },
    gaps: [],
    skillsReorder: { before: [], after: [], reason: 'Test' },
    interviewPrep: [],
    scoreCeiling,
  };
}

describe('normalizeImpactPoints', () => {
  it('does not normalize when sum <= budget', () => {
    const changes: ProposedChange[] = [
      { section: 'summary', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k1'], impactPoints: 5 },
      { section: 'skills', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k2'], impactPoints: 3 },
    ];
    // budget = min(100, 80) - 72 = 8, sum = 8
    const result = makeResult(72, 80, changes);
    const normalized = normalizeImpactPoints(result);

    expect(normalized.proposedChanges[0].impactPoints).toBe(5);
    expect(normalized.proposedChanges[1].impactPoints).toBe(3);
  });

  it('proportionally scales when sum > budget', () => {
    const changes: ProposedChange[] = [
      { section: 'summary', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k1'], impactPoints: 10 },
      { section: 'skills', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k2'], impactPoints: 10 },
      { section: 'experience.a', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k3'], impactPoints: 15 },
    ];
    // sum = 35, budget = min(100, 89) - 65 = 24
    const result = makeResult(65, 89, changes);
    const normalized = normalizeImpactPoints(result);

    const normalizedSum = normalized.proposedChanges.reduce((s, c) => s + c.impactPoints, 0);
    // Sum must equal budget (24) after rounding
    expect(Math.round(normalizedSum)).toBe(24);
    // Each should be scaled down proportionally
    expect(normalized.proposedChanges[0].impactPoints).toBeLessThan(10);
    expect(normalized.proposedChanges[1].impactPoints).toBeLessThan(10);
    expect(normalized.proposedChanges[2].impactPoints).toBeLessThan(15);
  });

  it('uses scoreCeiling.maximum for budget when present', () => {
    const changes: ProposedChange[] = [
      { section: 'summary', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k1'], impactPoints: 20 },
      { section: 'skills', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k2'], impactPoints: 15 },
    ];
    // sum = 35, ceiling = 85, budget = min(85, 89) - 65 = 20
    const result = makeResult(65, 89, changes, {
      maximum: 85,
      blockers: ['Missing React experience'],
      toReach90: 'Add React projects',
    });
    const normalized = normalizeImpactPoints(result);

    const normalizedSum = normalized.proposedChanges.reduce((s, c) => s + c.impactPoints, 0);
    expect(Math.round(normalizedSum)).toBe(20);
  });

  it('scales impactPerKeyword proportionally', () => {
    const changes: ProposedChange[] = [
      {
        section: 'summary', original: 'Old', modified: 'New', reason: 'Test',
        keywordsAdded: ['k1', 'k2'],
        impactPoints: 20,
        impactPerKeyword: 10,
      },
    ];
    // sum = 20, budget = min(100, 75) - 65 = 10, scaleFactor = 0.5
    const result = makeResult(65, 75, changes);
    const normalized = normalizeImpactPoints(result);

    expect(normalized.proposedChanges[0].impactPoints).toBe(10);
    expect(normalized.proposedChanges[0].impactPerKeyword).toBe(5);
  });

  it('handles zero budget (current >= ceiling) -- all impacts become 0', () => {
    const changes: ProposedChange[] = [
      { section: 'summary', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k1'], impactPoints: 10 },
      { section: 'skills', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k2'], impactPoints: 5 },
    ];
    // current = 85, ceiling = 85 => budget = min(85, 90) - 85 = 0
    const result = makeResult(85, 90, changes, {
      maximum: 85,
      blockers: ['Already at ceiling'],
      toReach90: 'N/A',
    });
    const normalized = normalizeImpactPoints(result);

    expect(normalized.proposedChanges[0].impactPoints).toBe(0);
    expect(normalized.proposedChanges[1].impactPoints).toBe(0);
  });

  it('rounding does not cause sum to exceed budget', () => {
    const changes: ProposedChange[] = [
      { section: 'a', original: 'O', modified: 'N', reason: 'T', keywordsAdded: ['k1'], impactPoints: 7 },
      { section: 'b', original: 'O', modified: 'N', reason: 'T', keywordsAdded: ['k2'], impactPoints: 7 },
      { section: 'c', original: 'O', modified: 'N', reason: 'T', keywordsAdded: ['k3'], impactPoints: 7 },
      { section: 'd', original: 'O', modified: 'N', reason: 'T', keywordsAdded: ['k4'], impactPoints: 7 },
      { section: 'e', original: 'O', modified: 'N', reason: 'T', keywordsAdded: ['k5'], impactPoints: 7 },
    ];
    // sum = 35, budget = 24
    const result = makeResult(65, 89, changes);
    const normalized = normalizeImpactPoints(result);

    const normalizedSum = normalized.proposedChanges.reduce((s, c) => s + c.impactPoints, 0);
    expect(normalizedSum).toBeLessThanOrEqual(24);
    // Should be close to budget (within 1 due to rounding)
    expect(normalizedSum).toBeGreaterThanOrEqual(23);
  });
});

describe('projected score with ceiling', () => {
  /**
   * Simulates the projected score calculation with ceiling cap.
   */
  function calculateProjectedScoreWithCeiling(
    baseScore: number,
    changes: ProposedChange[],
    acceptedIndices: Set<number>,
    editedTexts: Map<number, string>,
    scoreCeiling?: ScoreCeiling
  ): number {
    let score = baseScore;

    for (const [index, change] of changes.entries()) {
      if (!acceptedIndices.has(index)) continue;

      const editedText = editedTexts.get(index);
      if (editedText) {
        score += calculateEditedImpact(change, editedText);
      } else {
        score += change.impactPoints;
      }
    }

    const cap = scoreCeiling?.maximum ?? 100;
    return Math.min(cap, score);
  }

  it('caps at ceiling when present', () => {
    const changes: ProposedChange[] = [
      { section: 'summary', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k1'], impactPoints: 30 },
    ];

    const score = calculateProjectedScoreWithCeiling(
      65,
      changes,
      new Set([0]),
      new Map(),
      { maximum: 85, blockers: ['Missing React'], toReach90: 'Add React' }
    );

    expect(score).toBe(85); // Capped at ceiling, not 95
  });

  it('does not cap beyond 100 when no ceiling', () => {
    const changes: ProposedChange[] = [
      { section: 'summary', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k1'], impactPoints: 50 },
    ];

    const score = calculateProjectedScoreWithCeiling(
      72,
      changes,
      new Set([0]),
      new Map()
    );

    expect(score).toBe(100); // Capped at default 100
  });

  it('works with edit-aware rescoring + ceiling', () => {
    const changes: ProposedChange[] = [
      {
        section: 'summary', original: 'Old', modified: 'New with k1 and k2', reason: 'Test',
        keywordsAdded: ['k1', 'k2'],
        impactPoints: 30,
        impactPerKeyword: 15,
      },
    ];

    // User edits to keep only k1, so impact = 15
    const score = calculateProjectedScoreWithCeiling(
      65,
      changes,
      new Set([0]),
      new Map([[0, 'New with k1 only']]),
      { maximum: 85, blockers: ['Gap'], toReach90: 'Fix gap' }
    );

    expect(score).toBe(80); // 65 + 15 = 80, which is below ceiling of 85
  });

  it('ceiling does not lift score (only caps downward)', () => {
    const changes: ProposedChange[] = [
      { section: 'summary', original: 'Old', modified: 'New', reason: 'Test', keywordsAdded: ['k1'], impactPoints: 5 },
    ];

    const score = calculateProjectedScoreWithCeiling(
      65,
      changes,
      new Set([0]),
      new Map(),
      { maximum: 85, blockers: ['Gap'], toReach90: 'Fix gap' }
    );

    expect(score).toBe(70); // 65 + 5 = 70, below ceiling so no capping
  });
});
