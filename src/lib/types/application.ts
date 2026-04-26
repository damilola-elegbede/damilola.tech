/**
 * Application tracking types.
 */

export const APPLICATION_STATUSES = [
  'applied',
  'screen',
  'interview',
  'offer',
  'rejected',
  'withdrawn',
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface Application {
  id: string;
  company: string;
  title: string;
  url: string | null;
  role_id: string | null;
  applied_at: string; // ISO-Z
  status: ApplicationStatus;
  score: number | null; // 0–100
  notes: string | null;
  created_at: string; // ISO-Z
  updated_at: string; // ISO-Z
}

/** Subset returned in POST 201 and GET list items */
export type ApplicationSummary = Pick<
  Application,
  'id' | 'company' | 'title' | 'applied_at' | 'status' | 'score' | 'url' | 'notes' | 'role_id'
>;
