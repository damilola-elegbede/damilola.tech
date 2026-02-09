/**
 * Deterministic ATS Scoring
 *
 * Research-backed scoring algorithm for ATS compatibility.
 * Produces identical scores across multiple runs for the same inputs.
 *
 * Scoring breakdown (0-100 total):
 * - Keyword Relevance: 0-45 points (weighted by JD section priority)
 * - Skills Quality: 0-25 points
 * - Experience Alignment: 0-20 points (years, team/depth, title, education)
 * - Content Quality: 0-10 points (metrics, action verbs, structure)
 *
 * Sources: 20+ industry sources including Jobscan, Indeed, LinkedIn Talent Report
 */

import {
  extractKeywords,
  matchKeywords,
  wordCount,
  calculateMatchRate,
  calculateKeywordDensity,
  calculateActualKeywordDensity,
  stemWord,
  ACTION_VERBS,
  type ExtractedKeywords,
  type MatchResult,
  type KeywordPriority,
} from './ats-keywords';

/**
 * Score breakdown by category.
 */
export interface ScoreBreakdown {
  /** Keyword matching score (0-45) */
  keywordRelevance: number;
  /** Skills section quality (0-25) */
  skillsQuality: number;
  /** Experience alignment (0-20) */
  experienceAlignment: number;
  /** Content quality score (0-10) */
  contentQuality: number;
}

/**
 * Detailed ATS score with breakdown and analysis.
 */
export interface ATSScore {
  /** Total score (0-100) */
  total: number;
  /** Score breakdown by category */
  breakdown: ScoreBreakdown;
  /** Whether the generated PDF is ATS-optimized */
  isATSOptimized: boolean;
  /** Detailed matching information */
  details: {
    /** Keywords that matched in the resume */
    matchedKeywords: string[];
    /** Keywords that were not found */
    missingKeywords: string[];
    /** Keyword density percentage */
    keywordDensity: number;
    /** Match rate percentage */
    matchRate: number;
    /** All extracted keywords from JD */
    extractedKeywords: ExtractedKeywords;
    /** Match details for analysis */
    matchDetails: MatchResult['matchDetails'];
  };
}

/**
 * Resume data structure for scoring.
 */
export interface ResumeData {
  /** Candidate's current/target title */
  title?: string;
  /** Years of experience (can be extracted from text) */
  yearsExperience?: number;
  /** Skills listed in the resume */
  skills?: string[];
  /** Structured skills by category */
  skillsByCategory?: Array<{ category: string; items: string[] }>;
  /** Team size managed (e.g., "13 engineers") */
  teamSize?: string;
  /** Experience entries */
  experiences?: Array<{
    title?: string;
    company?: string;
    highlights?: string[];
  }>;
  /** Education entries */
  education?: Array<{
    degree?: string;
    institution?: string;
  }>;
}

/**
 * Input for ATS scoring.
 */
export interface ScoringInput {
  /** Job description text */
  jobDescription: string;
  /** Full text of the resume (for keyword matching) */
  resumeText: string;
  /** Structured resume data */
  resumeData: ResumeData;
}

/**
 * Calculate keyword relevance score (0-45 points).
 *
 * Keywords are weighted by their JD section priority:
 * - Title keywords: 3 pts (exact), 2 pts (stem), 1.5 pts (synonym)
 * - Required keywords: 2.5 pts (exact), 2 pts (stem), 1 pt (synonym)
 * - Nice-to-have: 1.5 pts (exact), 1 pt (stem), 0.5 pt (synonym)
 * - General: 1 pt (exact), 0.5 pt (stem/synonym)
 *
 * Penalty: -5 if actual keyword density > 3% or any keyword stuffed (5+ occurrences)
 */
function calculateKeywordScore(
  matchResult: MatchResult,
  extractedKeywords: ExtractedKeywords,
  resumeText: string,
  resumeWordCount: number
): number {
  let score = 0;
  const priorities = extractedKeywords.keywordPriorities;

  // Calculate points based on match type AND keyword priority
  for (const detail of matchResult.matchDetails) {
    const priority: KeywordPriority = priorities[detail.keyword] || 'general';

    switch (priority) {
      case 'title':
        switch (detail.matchType) {
          case 'exact': score += 3; break;
          case 'stem': score += 2; break;
          case 'synonym': score += 1.5; break;
        }
        break;
      case 'required':
        switch (detail.matchType) {
          case 'exact': score += 2.5; break;
          case 'stem': score += 2; break;
          case 'synonym': score += 1; break;
        }
        break;
      case 'niceToHave':
        switch (detail.matchType) {
          case 'exact': score += 1.5; break;
          case 'stem': score += 1; break;
          case 'synonym': score += 0.5; break;
        }
        break;
      default: // 'general'
        switch (detail.matchType) {
          case 'exact': score += 1; break;
          case 'stem': score += 0.5; break;
          case 'synonym': score += 0.5; break;
        }
        break;
    }
  }

  // Cap at 45 points
  score = Math.min(score, 45);

  // Penalty for keyword stuffing using actual occurrence-based density
  const actualDensity = calculateActualKeywordDensity(resumeText, matchResult.matched);
  if (actualDensity.overallDensity > 3 || actualDensity.stuffedKeywords.length > 0) {
    score = Math.max(0, score - 5);
  }

  return Math.round(score * 10) / 10; // One decimal place
}

/**
 * Calculate skills quality score (0-25 points).
 *
 * Scoring:
 * - Required skills present: (matched/required) * 15 points
 * - Skills aligned with JD priority: 5 points
 * - Skills section well-organized: 5 points
 */
function calculateSkillsScore(
  extractedKeywords: ExtractedKeywords,
  resumeData: ResumeData,
): number {
  let score = 0;

  // Get all skills from resume
  const resumeSkills = new Set<string>();
  if (resumeData.skills) {
    for (const skill of resumeData.skills) {
      resumeSkills.add(skill.toLowerCase());
    }
  }
  if (resumeData.skillsByCategory) {
    for (const category of resumeData.skillsByCategory) {
      for (const item of category.items) {
        resumeSkills.add(item.toLowerCase());
      }
    }
  }

  // Count how many JD technologies are in resume skills
  const techKeywords = extractedKeywords.technologies;
  let techMatches = 0;
  for (const tech of techKeywords) {
    if (resumeSkills.has(tech) || [...resumeSkills].some(s => s.includes(tech))) {
      techMatches++;
    }
  }

  // Required skills present (max 15 points)
  if (techKeywords.length > 0) {
    score += Math.min(15, (techMatches / techKeywords.length) * 15);
  } else {
    // No specific tech requirements - give partial credit for having skills
    score += resumeSkills.size > 0 ? 10 : 0;
  }

  // Skills aligned with JD priority (5 points)
  // Check if top JD keywords appear in skills section
  const topJdKeywords = extractedKeywords.all.slice(0, 5);
  let alignedCount = 0;
  for (const keyword of topJdKeywords) {
    if (resumeSkills.has(keyword) ||
        [...resumeSkills].some(s => s.toLowerCase().includes(keyword.toLowerCase()))) {
      alignedCount++;
    }
  }
  score += (alignedCount / Math.max(topJdKeywords.length, 1)) * 5;

  // Skills section organization (5 points)
  // Give full points if skills are categorized
  if (resumeData.skillsByCategory && resumeData.skillsByCategory.length > 0) {
    score += 5;
  } else if (resumeData.skills && resumeData.skills.length > 0) {
    score += 3;
  }

  return Math.round(score * 10) / 10;
}

/**
 * Extract years of experience from JD text.
 */
function extractYearsFromJd(jd: string): number | null {
  // Look for patterns like "8+ years", "5-7 years", "10 years"
  const patterns = [
    /(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)/i,
    /(\d+)\s*-\s*\d+\s*(?:years?|yrs?)/i,
    /minimum\s+(?:of\s+)?(\d+)\s*(?:years?|yrs?)/i,
  ];

  for (const pattern of patterns) {
    const match = jd.match(pattern);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Extract team size from JD text.
 */
function extractTeamSizeFromJd(jd: string): number | null {
  // Look for patterns like "team of 6", "manage 10+ engineers", "6-10 engineers"
  const patterns = [
    /(?:team\s+of|manage|lead)\s+(\d+)/i,
    /(\d+)\+?\s*(?:engineers?|developers?|reports?)/i,
    /(\d+)\s*-\s*(\d+)\s*(?:engineers?|developers?)/i,
  ];

  for (const pattern of patterns) {
    const match = jd.match(pattern);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  return null;
}

/**
 * Extract team size from resume data.
 */
function extractTeamSizeFromResume(resumeData: ResumeData): number | null {
  // Check explicit team size field
  if (resumeData.teamSize) {
    const match = resumeData.teamSize.match(/(\d+)/);
    if (match?.[1]) {
      return parseInt(match[1], 10);
    }
  }

  // Look in experience highlights
  if (resumeData.experiences) {
    for (const exp of resumeData.experiences) {
      if (exp.highlights) {
        for (const highlight of exp.highlights) {
          // Look for team size mentions
          const match = highlight.match(/(?:team\s+of|scaling\s+to|led|managed)\s+(\d+)\s*(?:engineers?|people|members|reports)/i);
          if (match?.[1]) {
            return parseInt(match[1], 10);
          }
        }
      }
    }
  }

  return null;
}

/**
 * Detect whether a JD is for an IC (individual contributor) or management role.
 */
function detectRoleType(jd: string): 'ic' | 'management' | 'unknown' {
  const lower = jd.toLowerCase();
  const mgmtSignals = ['manage', 'direct reports', 'team of', 'people management',
    'managing', 'supervise', 'leadership of', 'lead a team', 'build a team',
    'engineering manager', 'director of', 'head of'];
  const icSignals = ['individual contributor', 'hands-on', 'write code',
    'coding', 'implement', 'no direct reports', 'ic role'];

  let mgmtScore = 0;
  let icScore = 0;

  for (const signal of mgmtSignals) {
    if (lower.includes(signal)) mgmtScore++;
  }
  for (const signal of icSignals) {
    if (lower.includes(signal)) icScore++;
  }

  if (mgmtScore > icScore && mgmtScore >= 2) return 'management';
  if (icScore > mgmtScore && icScore >= 1) return 'ic';
  return 'unknown';
}

/**
 * Education level enumeration for matching.
 */
type EducationLevel = 'bachelor' | 'master' | 'phd' | 'associate' | null;

/**
 * Extract education requirement from JD.
 */
function extractEducationFromJd(jd: string): { level: EducationLevel; field: string | null } {
  const lower = jd.toLowerCase();

  let level: EducationLevel = null;
  let field: string | null = null;

  // Check for degree levels (most specific first)
  if (/\b(ph\.?d|doctorate|doctoral)\b/.test(lower)) {
    level = 'phd';
  } else if (/\b(master'?s?|m\.?s\.?|m\.?a\.?|mba)\b/.test(lower)) {
    level = 'master';
  } else if (/\b(bachelor'?s?|b\.?s\.?|b\.?a\.?|undergraduate|college degree)\b/.test(lower)) {
    level = 'bachelor';
  } else if (/\b(associate'?s?|a\.?s\.?)\b/.test(lower)) {
    level = 'associate';
  }

  // Check for field requirements
  // Match "IT" only as uppercase in original text to avoid matching the pronoun "it"
  if (/\b(computer science|cs|software engineering|information technology)\b/.test(lower) || /\bI\.?T\.?\b/.test(jd)) {
    field = 'cs';
  } else if (/\b(engineering|technical)\b/.test(lower) && level) {
    field = 'engineering';
  }

  return { level, field };
}

/**
 * Match education level from resume data.
 */
function matchEducation(
  resumeData: ResumeData,
  jdRequirement: { level: EducationLevel; field: string | null }
): number {
  if (!jdRequirement.level || !resumeData.education || resumeData.education.length === 0) {
    return 0; // No education requirement or no education data
  }

  const educationLevels: Record<string, number> = {
    'associate': 1, 'bachelor': 2, 'master': 3, 'phd': 4,
  };

  const requiredLevel = educationLevels[jdRequirement.level] || 0;
  let bestLevel = 0;
  let fieldMatch = false;

  for (const edu of resumeData.education) {
    const degreeLower = (edu.degree || '').toLowerCase();

    // Detect level
    if (/\b(ph\.?d|doctorate)\b/.test(degreeLower)) bestLevel = Math.max(bestLevel, 4);
    else if (/\b(master|m\.?s\.?|m\.?a\.?|mba)\b/.test(degreeLower)) bestLevel = Math.max(bestLevel, 3);
    else if (/\b(bachelor|b\.?s\.?|b\.?a\.?)\b/.test(degreeLower)) bestLevel = Math.max(bestLevel, 2);
    else if (/\b(associate|a\.?s\.?)\b/.test(degreeLower)) bestLevel = Math.max(bestLevel, 1);

    // Check field
    if (jdRequirement.field === 'cs' &&
        /\b(computer|software|information|computing|cs)\b/.test(degreeLower)) {
      fieldMatch = true;
    } else if (jdRequirement.field === 'engineering' &&
               /\b(engineer|technical|computer|science)\b/.test(degreeLower)) {
      fieldMatch = true;
    }
  }

  let points = 0;
  if (bestLevel >= requiredLevel) {
    points = 2; // Meets or exceeds level
  } else if (bestLevel >= requiredLevel - 1) {
    points = 1; // Close (e.g., has bachelor's, needs master's)
  }

  // Bonus for field match
  if (fieldMatch && points > 0) {
    points = Math.min(3, points + 1);
  }

  return points;
}

/**
 * Calculate experience alignment score (0-20 points).
 *
 * For management roles:
 * - Years match: 6 points
 * - Team size match: 6 points
 * - Title match: 5 points
 * - Education match: 3 points
 *
 * For IC roles (team size reallocated):
 * - Years match: 9 points (6 + 3 from team)
 * - Technical depth: 3 points (remaining from team)
 * - Title match: 5 points
 * - Education match: 3 points
 */
function calculateExperienceScore(
  jd: string,
  resumeData: ResumeData,
  extractedKeywords: ExtractedKeywords
): number {
  let score = 0;
  const roleType = detectRoleType(jd);
  const isIC = roleType === 'ic';

  // Years of experience match (6 pts management, 9 pts IC)
  const yearsMax = isIC ? 9 : 6;
  const jdYears = extractYearsFromJd(jd);
  const resumeYears = resumeData.yearsExperience;

  if (jdYears !== null && resumeYears !== undefined) {
    if (resumeYears >= jdYears) {
      score += yearsMax; // Meets or exceeds
    } else if (resumeYears >= jdYears - 2) {
      score += Math.round(yearsMax * 0.625 * 10) / 10; // ~63%
    } else if (resumeYears >= jdYears - 5) {
      score += Math.round(yearsMax * 0.25 * 10) / 10; // 25%
    }
  } else if (resumeYears !== undefined && resumeYears >= 5) {
    score += Math.round(yearsMax * 0.625 * 10) / 10; // partial credit
  }

  // Team size / technical depth
  if (isIC) {
    // IC: 3 points for technical depth (having many skills + experience)
    const hasMultipleExperiences = (resumeData.experiences?.length || 0) >= 2;
    const hasSkills = (resumeData.skills?.length || 0) + (resumeData.skillsByCategory?.length || 0) > 0;
    if (hasMultipleExperiences && hasSkills) {
      score += 3;
    } else if (hasMultipleExperiences || hasSkills) {
      score += 1.5;
    }
  } else {
    // Management: Team size match (6 points)
    const jdTeamSize = extractTeamSizeFromJd(jd);
    const resumeTeamSize = extractTeamSizeFromResume(resumeData);

    if (jdTeamSize !== null && resumeTeamSize !== null) {
      if (resumeTeamSize >= jdTeamSize) {
        score += 6;
      } else if (resumeTeamSize >= jdTeamSize * 0.7) {
        score += 4;
      } else if (resumeTeamSize >= jdTeamSize * 0.5) {
        score += 2;
      }
    } else if (resumeTeamSize !== null && resumeTeamSize > 0) {
      score += 3; // Has team management experience
    }
  }

  // Title match (5 points)
  const resumeTitle = resumeData.title?.toLowerCase() || '';
  const titleKeywords = extractedKeywords.fromTitle.map(k => k.toLowerCase());

  let titleMatches = 0;
  for (const keyword of titleKeywords) {
    if (resumeTitle.includes(keyword) ||
        stemWord(resumeTitle).includes(stemWord(keyword))) {
      titleMatches++;
    }
  }

  if (titleKeywords.length > 0) {
    const titleMatchRate = titleMatches / titleKeywords.length;
    score += titleMatchRate * 5;
  } else {
    const hasRelevantTitle = /\b(manager|director|lead|senior|staff|principal)\b/i.test(resumeTitle);
    if (hasRelevantTitle) {
      score += 2.5;
    }
  }

  // Education match (3 points)
  const educationReq = extractEducationFromJd(jd);
  if (educationReq.level) {
    score += matchEducation(resumeData, educationReq);
  } else if (resumeData.education && resumeData.education.length > 0) {
    // No explicit requirement but candidate has education — small bonus
    score += 1;
  }

  return Math.min(20, Math.round(score * 10) / 10);
}

/**
 * Calculate content quality score (0-10 points).
 *
 * Scoring:
 * - Metrics presence (5 pts): Experience bullets with numbers/percentages/dollar amounts
 * - Action verb usage (3 pts): Bullets starting with strong action verbs
 * - Bullet structure (2 pts): Consistent bullet formatting
 */
function calculateContentQuality(resumeData: ResumeData): number {
  let score = 0;

  if (!resumeData.experiences || resumeData.experiences.length === 0) {
    return 0;
  }

  // Collect all highlights
  const allHighlights: string[] = [];
  for (const exp of resumeData.experiences) {
    if (exp.highlights) {
      allHighlights.push(...exp.highlights);
    }
  }

  if (allHighlights.length === 0) return 0;

  // Metrics presence (5 pts): proportion of bullets with quantified achievements
  const metricsPattern = /(\d+%|\$[\d,]+|\d+x|\d+\+|\d[\d,]*\s*(?:engineers?|people|users?|systems?|teams?))/i;
  let bulletsWithMetrics = 0;
  for (const bullet of allHighlights) {
    if (metricsPattern.test(bullet)) {
      bulletsWithMetrics++;
    }
  }
  const metricsRate = bulletsWithMetrics / allHighlights.length;
  score += Math.min(5, metricsRate * 5);

  // Action verb usage (3 pts): proportion starting with action verbs
  let bulletsWithActionVerbs = 0;
  for (const bullet of allHighlights) {
    const firstWord = bullet.trim().split(/\s+/)[0]?.toLowerCase();
    if (firstWord && ACTION_VERBS.has(firstWord)) {
      bulletsWithActionVerbs++;
    }
  }
  const actionVerbRate = bulletsWithActionVerbs / allHighlights.length;
  score += Math.min(3, actionVerbRate * 3);

  // Bullet structure (2 pts): consistent formatting
  // Check if bullets are reasonably sized (not too short, not too long)
  let wellFormatted = 0;
  for (const bullet of allHighlights) {
    const wordLen = bullet.trim().split(/\s+/).length;
    if (wordLen >= 5 && wordLen <= 40) {
      wellFormatted++;
    }
  }
  const structureRate = wellFormatted / allHighlights.length;
  score += Math.min(2, structureRate * 2);

  return Math.round(score * 10) / 10;
}

/**
 * Create empty ExtractedKeywords with all fields.
 */
function emptyExtractedKeywords(): ExtractedKeywords {
  return {
    all: [],
    fromTitle: [],
    fromRequired: [],
    fromNiceToHave: [],
    technologies: [],
    actionVerbs: [],
    keywordPriorities: {},
  };
}

/**
 * Calculate ATS score for a resume against a job description.
 *
 * This function is deterministic - given the same inputs, it will always
 * produce the same outputs.
 *
 * @param input - Scoring input with JD, resume text, and resume data
 * @returns Detailed ATS score with breakdown and analysis
 */
export function calculateATSScore(input: ScoringInput): ATSScore {
  const { jobDescription, resumeText, resumeData } = input;

  // Handle edge cases
  if (!jobDescription || jobDescription.trim().length === 0) {
    return {
      total: 0,
      isATSOptimized: true,
      breakdown: {
        keywordRelevance: 0,
        skillsQuality: 0,
        experienceAlignment: 0,
        contentQuality: 0,
      },
      details: {
        matchedKeywords: [],
        missingKeywords: [],
        keywordDensity: 0,
        matchRate: 0,
        extractedKeywords: emptyExtractedKeywords(),
        matchDetails: [],
      },
    };
  }

  if (!resumeText || resumeText.trim().length === 0) {
    const extractedKeywords = extractKeywords(jobDescription, 20);
    return {
      total: 0,
      isATSOptimized: true,
      breakdown: {
        keywordRelevance: 0,
        skillsQuality: 0,
        experienceAlignment: 0,
        contentQuality: 0,
      },
      details: {
        matchedKeywords: [],
        missingKeywords: extractedKeywords.all,
        keywordDensity: 0,
        matchRate: 0,
        extractedKeywords,
        matchDetails: [],
      },
    };
  }

  // 1. Extract keywords from JD (dynamic count based on JD complexity)
  const extractedKeywords = extractKeywords(jobDescription);

  // 2. Match keywords against resume
  const matchResult = matchKeywords(extractedKeywords.all, resumeText);

  // 3. Calculate word count for density
  const resumeWordCount = wordCount(resumeText);

  // 4. Calculate each score component
  const keywordRelevance = calculateKeywordScore(matchResult, extractedKeywords, resumeText, resumeWordCount);
  const skillsQuality = calculateSkillsScore(extractedKeywords, resumeData);
  const experienceAlignment = calculateExperienceScore(jobDescription, resumeData, extractedKeywords);
  const contentQuality = calculateContentQuality(resumeData);

  // 5. Calculate total and create result
  const total = Math.round((keywordRelevance + skillsQuality + experienceAlignment + contentQuality) * 10) / 10;

  return {
    total: Math.min(100, total), // Cap at 100
    isATSOptimized: true,
    breakdown: {
      keywordRelevance,
      skillsQuality,
      experienceAlignment,
      contentQuality,
    },
    details: {
      matchedKeywords: matchResult.matched,
      missingKeywords: matchResult.missing,
      keywordDensity: calculateKeywordDensity(matchResult.matched.length, resumeWordCount),
      matchRate: calculateMatchRate(matchResult.matched.length, extractedKeywords.all.length),
      extractedKeywords,
      matchDetails: matchResult.matchDetails,
    },
  };
}

/**
 * Generate a plain text version of the resume for scoring.
 * Used when only structured data is available.
 */
export function resumeDataToText(data: ResumeData & {
  name?: string;
  summary?: string;
}): string {
  const parts: string[] = [];

  if (data.name) parts.push(data.name);
  if (data.title) parts.push(data.title);
  if (data.summary) parts.push(data.summary);

  // Skills
  if (data.skillsByCategory) {
    for (const category of data.skillsByCategory) {
      parts.push(category.category + ': ' + category.items.join(', '));
    }
  } else if (data.skills) {
    parts.push('Skills: ' + data.skills.join(', '));
  }

  // Experience
  if (data.experiences) {
    for (const exp of data.experiences) {
      if (exp.title) parts.push(exp.title);
      if (exp.company) parts.push(exp.company);
      if (exp.highlights) {
        parts.push(...exp.highlights);
      }
    }
  }

  // Education
  if (data.education) {
    for (const edu of data.education) {
      if (edu.degree) parts.push(edu.degree);
      if (edu.institution) parts.push(edu.institution);
    }
  }

  return parts.join('\n');
}

/**
 * Format score for display.
 */
export function formatScoreAssessment(score: number): string {
  if (score >= 80) return 'Excellent match - highly likely to pass ATS filters';
  if (score >= 65) return 'Good match - should pass most ATS systems';
  if (score >= 50) return 'Fair match - optimization recommended';
  return 'Weak match - significant gaps identified';
}
