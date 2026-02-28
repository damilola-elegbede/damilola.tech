export interface ActivitySummary {
  id: string; // UUID
  weekEnding: string; // ISO date string (the Sunday)
  headline: string; // One-line summary, max 200 chars
  highlights: string[]; // 3-7 bullet points of what shipped
  metrics: {
    prsShipped: number;
    testsPassing: number;
    featuresDelivered: number;
  };
  tags: string[]; // e.g. ["infrastructure", "api", "testing"]
  createdAt: string; // ISO timestamp
}
