/**
 * Types for the Resume Generator feature.
 *
 * Scoring rubric (Readiness Score 0-100):
 * - Role Relevance (30): JD keywords findable in resume, title alignment, skills coverage
 * - Clarity & Skimmability (30): Summary quality, section structure, bullet conciseness, frontloading
 * - Business Impact (25): Quantified achievements, outcomes over duties, metric-rich bullets
 * - Presentation Quality (15): Natural keyword embedding, title bridging, professional structure
 */

// Re-export job ID types for convenience
export type { JobId, JobIdentifier } from '@/lib/job-id';

export interface ScoreBreakdown {
  /** Role relevance score — JD keywords, title alignment, skills coverage (0-30) */
  roleRelevance: number;
  /** Clarity & skimmability — structure, conciseness, frontloading (0-30) */
  claritySkimmability: number;
  /** Business impact — quantified achievements, outcomes over duties (0-25) */
  businessImpact: number;
  /** Presentation quality — natural keyword use, title bridging, completeness (0-15) */
  presentationQuality: number;
}

/**
 * Legacy score breakdown field names (V1/V2 logs).
 * Used for reading old stored data before migration.
 */
export interface LegacyScoreBreakdown {
  keywordRelevance: number;
  skillsQuality: number;
  experienceAlignment: number;
  contentQuality: number;
}

/**
 * Proportionally scale old breakdown (45/25/20/10) to new (30/30/25/15).
 */
export function migrateBreakdownToV3(old: LegacyScoreBreakdown): ScoreBreakdown {
  return {
    roleRelevance: Math.round((old.keywordRelevance / 45) * 30),
    claritySkimmability: Math.round((old.skillsQuality / 25) * 30),
    businessImpact: Math.round((old.experienceAlignment / 20) * 25),
    presentationQuality: Math.round((old.contentQuality / 10) * 15),
  };
}

/**
 * Type guard to detect legacy breakdown shape.
 */
export function isLegacyBreakdown(b: unknown): b is LegacyScoreBreakdown {
  if (!b || typeof b !== 'object') return false;
  const obj = b as Record<string, unknown>;
  return 'keywordRelevance' in obj && 'skillsQuality' in obj &&
    'experienceAlignment' in obj && 'contentQuality' in obj;
}

/**
 * Normalize a breakdown, converting legacy format if needed.
 */
export function normalizeBreakdown(b: ScoreBreakdown | LegacyScoreBreakdown): ScoreBreakdown {
  if (isLegacyBreakdown(b)) {
    return migrateBreakdownToV3(b);
  }
  return b as ScoreBreakdown;
}

export interface EstimatedCompatibility {
  /** Total score before optimization (0-100) */
  before: number;
  /** Total score after optimization (0-100) */
  after: number;
  /** Maximum score if all proposed changes were accepted (0-100) */
  possibleMax?: number;
  /** Detailed breakdown of score components */
  breakdown: ScoreBreakdown;
}

/**
 * Per-category impact breakdown for a proposed change.
 * Values are non-negative integers that sum to impactPoints.
 */
export interface ImpactBreakdown {
  /** Role relevance impact (0-30, integer) */
  roleRelevance: number;
  /** Clarity & skimmability impact (0-30, integer) */
  claritySkimmability: number;
  /** Business impact (0-25, integer) */
  businessImpact: number;
  /** Presentation quality impact (0-15, integer) */
  presentationQuality: number;
}

export interface ProposedChange {
  /** Section being modified (e.g., "summary", "experience.verily.bullet1") */
  section: string;
  /** Original content */
  original: string;
  /** Proposed modified content */
  modified: string;
  /** Explanation of why this change improves readability and relevance */
  reason: string;
  /** Relevance signals from JD that were incorporated */
  relevanceSignals: string[];
  /** Estimated points gained from this change */
  impactPoints: number;
  /** Points per signal for edit-aware rescoring (impactPoints / relevanceSignals.length) */
  impactPerSignal?: number;
  /** Per-category impact breakdown (optional for backward compat with V1/V2/V3 logs) */
  impactBreakdown?: ImpactBreakdown;
}

/**
 * Status of a change during the review workflow.
 * - pending: Not yet reviewed by user
 * - accepted: User approved the change
 * - rejected: User rejected the change
 */
export type ChangeStatus = 'pending' | 'accepted' | 'rejected';

/**
 * A proposed change with user review information.
 * Tracks edits, feedback, and review timestamp.
 */
export interface ReviewedChange {
  /** The original AI-proposed change */
  originalChange: ProposedChange;
  /** Current review status */
  status: ChangeStatus;
  /** User's edited version of the proposed text (if edited before accepting) */
  editedText?: string;
  /** User feedback when rejecting a change */
  feedback?: string;
  /** ISO timestamp of when the review decision was made */
  reviewedAt?: string;
}

/**
 * Extended change type for logging with edit/rejection tracking.
 * Used when persisting generation logs.
 */
export interface LoggedChange extends ProposedChange {
  /** Whether the user edited the proposed text before accepting */
  wasEdited: boolean;
  /** The original AI-proposed text if user edited it */
  originalModified?: string;
  /** User's feedback if this change was rejected */
  rejectionFeedback?: string;
}

export interface Gap {
  /** The JD requirement that's not met */
  requirement: string;
  /** How serious is this gap */
  severity: 'critical' | 'moderate' | 'minor';
  /** Is this skill/experience in the resume */
  inResume: boolean;
  /** Suggested way to address in interview or cover letter */
  mitigation: string;
}

export interface JDAnalysis {
  /** Brief summary of the role and key requirements */
  jdSummary: string;
  /** Company name extracted from JD */
  companyName: string;
  /** Role title extracted from JD */
  roleTitle: string;
  /** Department or team if mentioned */
  department?: string;
  /** Top keywords from JD (titles, skills, technologies, action verbs) */
  topKeywords: string[];
  /** Required skills identified */
  requiredSkills: string[];
  /** Nice-to-have skills identified */
  niceToHaveSkills: string[];
  /** Years of experience required */
  yearsRequired: string;
  /** Team size or scope mentioned */
  teamSize?: string;
  /** Expected scope of responsibility */
  scopeExpected?: string;
  /** Industry-specific requirements or context */
  industryContext?: string;
}

export interface SkillsReorder {
  /** Original order of skills */
  before: string[];
  /** Proposed new order based on JD relevance */
  after: string[];
  /** Explanation of reordering rationale */
  reason: string;
}

/**
 * Score ceiling information when maximum readiness is constrained.
 * Documents the maximum possible score and what would improve it.
 */
export interface ScoreCeiling {
  /** Maximum achievable readiness score given the content gaps */
  maximum: number;
  /** Specific gaps blocking higher readiness */
  blockers: string[];
  /** What additions would improve the readiness score */
  toImprove: string;
}

/**
 * Strategic note documenting optimization decisions.
 * Used to explain title-bridging language, keyword strategies, or other non-obvious choices.
 */
export interface OptimizationNote {
  /** Brief category (e.g., "Title Positioning", "Keyword Strategy") */
  topic: string;
  /** Clear justification for the approach */
  explanation: string;
}

export interface ResumeAnalysisResult {
  /** Analysis of the job description */
  analysis: JDAnalysis;
  /** Current resume score before optimization */
  currentScore: {
    /** Total score (0-100) */
    total: number;
    /** Score breakdown by component */
    breakdown: ScoreBreakdown;
    /** Assessment summary */
    assessment: string;
  };
  /** Proposed changes to optimize the resume */
  proposedChanges: ProposedChange[];
  /** Projected score after accepting all changes */
  optimizedScore: {
    /** Total score (0-100) */
    total: number;
    /** Score breakdown by component */
    breakdown: ScoreBreakdown;
    /** Assessment summary */
    assessment: string;
  };
  /** Gaps identified between resume and JD */
  gaps: Gap[];
  /** Proposed skills section reordering */
  skillsReorder: SkillsReorder;
  /** Interview preparation tips based on gaps */
  interviewPrep: string[];
  /** Score ceiling when optimizedScore < 90 (explains why 90+ not achievable) */
  scoreCeiling?: ScoreCeiling;
  /** Strategic notes documenting optimization decisions (title positioning, keyword strategy, etc.) */
  notes?: OptimizationNote[];
}

export type ApplicationStatus = 'draft' | 'applied' | 'interview' | 'offer' | 'rejected';

/**
 * Entry in the generation history for a tracked job.
 * Each time a resume is regenerated for the same job, a history entry is added.
 */
export interface GenerationHistoryEntry {
  /** Unique ID of this specific generation */
  generationId: string;
  /** When this generation was created */
  generatedAt: string;
  /** URL of the PDF for this generation */
  pdfUrl: string;
  /** Readiness score before optimization */
  scoreBefore: number;
  /** Readiness score after optimization */
  scoreAfter: number;
  /** Number of proposed changes that were accepted */
  changesAccepted: number;
  /** Number of proposed changes that were rejected */
  changesRejected: number;
}

/**
 * Filters for querying resume generations.
 */
export interface ResumeGenerationFilters {
  /** Filter by application status */
  applicationStatus?: ApplicationStatus;
  /** Filter by company name (partial match, case-insensitive) */
  companyName?: string;
  /** Filter by date range - start */
  dateFrom?: string;
  /** Filter by date range - end */
  dateTo?: string;
  /** Filter by minimum final (after) score */
  minScore?: number;
  /** Filter by maximum final (after) score */
  maxScore?: number;
}

/**
 * V1 resume generation log (original format).
 * Retained for backward compatibility during lazy migration.
 */
export interface ResumeGenerationLogV1 {
  /** Schema version for future migrations */
  version: 1;
  /** Unique identifier for this generation */
  generationId: string;
  /** Environment (production or preview) */
  environment: string;
  /** Timestamp of generation */
  createdAt: string;

  // Job Details
  /** Whether input was pasted text or URL */
  inputType: 'text' | 'url';
  /** Original URL if URL was provided */
  extractedUrl?: string;
  /** Company name extracted from JD */
  companyName: string;
  /** Role title extracted from JD */
  roleTitle: string;
  /** Full JD text for reference */
  jobDescriptionFull: string;

  // Scoring
  /** Estimated compatibility scores (research-backed naming) */
  estimatedCompatibility: EstimatedCompatibility;

  // Changes Made
  /** Changes that were accepted */
  changesAccepted: ProposedChange[];
  /** Changes that were rejected */
  changesRejected: ProposedChange[];
  /** Gaps identified */
  gapsIdentified: Gap[];

  // Output
  /** URL of generated PDF in blob storage */
  pdfUrl: string;
  /** The optimized resume data */
  optimizedResumeJson: Record<string, unknown>;

  // Tracking
  /** Current application status */
  applicationStatus: ApplicationStatus;
  /** Date when application was submitted */
  appliedDate?: string;
  /** User notes about this application */
  notes?: string;
}

/**
 * V2 resume generation log with job tracking support.
 * Adds deduplication via jobId and generation history.
 */
export interface ResumeGenerationLogV2 {
  /** Schema version */
  version: 2;
  /** Unique job identifier (hash of URL or title+company) */
  jobId: string;
  /** How the job ID was generated */
  jobIdentifier: import('@/lib/job-id').JobIdentifier;
  /** Environment (production or preview) */
  environment: string;
  /** When this job was first tracked */
  createdAt: string;
  /** When this job record was last updated */
  updatedAt: string;

  // Job Details (latest)
  /** Whether input was pasted text or URL */
  inputType: 'text' | 'url';
  /** Original URL if URL was provided */
  extractedUrl?: string;
  /** Company name extracted from JD */
  companyName: string;
  /** Role title extracted from JD */
  roleTitle: string;
  /** Full JD text for reference */
  jobDescriptionFull: string;
  /** Date job was posted (extracted from JD, optional) */
  datePosted?: string;

  // Current/Latest Scoring
  /** Estimated compatibility scores from latest generation */
  estimatedCompatibility: EstimatedCompatibility;

  // Latest Changes Made
  /** Changes that were accepted in latest generation */
  changesAccepted: ProposedChange[];
  /** Changes that were rejected in latest generation */
  changesRejected: ProposedChange[];
  /** Gaps identified in latest generation */
  gapsIdentified: Gap[];

  // Current Output
  /** Most recent generation ID */
  generationId: string;
  /** URL of most recent generated PDF */
  pdfUrl: string;
  /** The optimized resume data from latest generation */
  optimizedResumeJson: Record<string, unknown>;

  // History
  /** All previous generations for this job (newest first) */
  generationHistory: GenerationHistoryEntry[];

  // Tracking
  /** Current application status */
  applicationStatus: ApplicationStatus;
  /** Date when application was submitted */
  appliedDate?: string;
  /** User notes about this application */
  notes?: string;
}

/**
 * V3 resume generation log with readiness scoring.
 * Uses new scoring rubric: Role Relevance / Clarity / Business Impact / Presentation.
 */
export interface ResumeGenerationLogV3 extends Omit<ResumeGenerationLogV2, 'version'> {
  /** Schema version */
  version: 3;
  /** Whether this resume is optimized for human readability */
  isOptimized: boolean;
}

/**
 * Union type for all resume generation log versions.
 * Used for reading - code should handle all versions.
 */
export type ResumeGenerationLog = ResumeGenerationLogV1 | ResumeGenerationLogV2 | ResumeGenerationLogV3;

/**
 * Type guard to check if a log is V3.
 */
export function isV3Log(log: ResumeGenerationLog): log is ResumeGenerationLogV3 {
  return log.version === 3;
}

/**
 * Type guard to check if a log is V2.
 */
export function isV2Log(log: ResumeGenerationLog): log is ResumeGenerationLogV2 {
  return log.version === 2;
}

/**
 * Type guard to check if a log is V1.
 */
export function isV1Log(log: ResumeGenerationLog): log is ResumeGenerationLogV1 {
  return log.version === 1;
}

export interface ResumeGenerationSummary {
  /** Unique identifier (blob pathname) */
  id: string;
  /** Job ID for deduplication (v2) or computed from v1 data */
  jobId: string;
  /** Generation ID (most recent) */
  generationId: string;
  /** Environment */
  environment: string;
  /** Creation timestamp */
  timestamp: string;
  /** Last updated timestamp (v2 only, same as timestamp for v1) */
  updatedAt: string;
  /** Company name */
  companyName: string;
  /** Role title */
  roleTitle: string;
  /** Score before optimization (most recent) */
  scoreBefore: number;
  /** Score after optimization (most recent) */
  scoreAfter: number;
  /** Maximum possible score if all proposed changes are accepted */
  scorePossibleMax?: number;
  /** Canonical current readiness score */
  currentScore?: number;
  /** Canonical possible max readiness score */
  possibleMaxScore?: number;
  /** Application status */
  applicationStatus: ApplicationStatus;
  /** Blob URL (only in detail responses, not list) */
  url?: string;
  /** Size in bytes */
  size: number;
  /** Number of generations for this job (1 for v1, history.length + 1 for v2) */
  generationCount: number;
  /** Indicates this record failed to parse from blob storage */
  parseError?: boolean;
}

export interface ResumeGeneratorRequest {
  /** Job description (text or URL) */
  jobDescription: string;
}

export interface ResumeGeneratorAnalyzeResponse {
  /** Analysis results */
  result: ResumeAnalysisResult;
  /** Whether input was detected as URL */
  wasUrl: boolean;
  /** Extracted URL if applicable */
  extractedUrl?: string;
}

export interface ResumeGeneratorGenerateRequest {
  /** Original JD text */
  jobDescription: string;
  /** Analysis result from analyze step */
  analysisResult: ResumeAnalysisResult;
  /** Indices of accepted changes */
  acceptedChangeIndices: number[];
}

export interface ResumeGeneratorGenerateResponse {
  /** URL of generated PDF */
  pdfUrl: string;
  /** Generation log ID for future reference */
  generationId: string;
}

/**
 * Request to modify a proposed change using AI.
 * User provides feedback on how to revise the change.
 */
export interface ModifyChangeRequest {
  /** The original AI-proposed change to modify */
  originalChange: ProposedChange;
  /** User's instructions on how to modify the change */
  modifyPrompt: string;
  /** Job description for context */
  jobDescription: string;
}

/**
 * Response from the modify-change API.
 * Contains the revised change based on user feedback.
 */
export interface ModifyChangeResponse {
  /** The AI-revised change */
  revisedChange: ProposedChange;
}
