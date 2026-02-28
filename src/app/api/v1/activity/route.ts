import { list, put } from "@vercel/blob";
import { randomUUID } from "crypto";
import { requireApiKey } from "@/lib/api-key-auth";
import { apiSuccess, Errors } from "@/lib/api-response";
import { checkGenericRateLimit, getClientIp } from "@/lib/rate-limit";
import type { ActivitySummary } from "@/lib/types/activity-summary";

export const runtime = "nodejs";

const ACTIVITY_PREFIX = "damilola.tech/activity/";

const RATE_LIMIT_CONFIG = {
  key: "activity-post",
  limit: 10,
  windowSeconds: 60,
};

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function validateBody(
  body: unknown,
):
  | { valid: true; data: Omit<ActivitySummary, "id" | "createdAt"> }
  | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object." };
  }

  const b = body as Record<string, unknown>;

  // weekEnding
  if (typeof b.weekEnding !== "string" || isNaN(Date.parse(b.weekEnding))) {
    return {
      valid: false,
      error: "`weekEnding` must be a valid ISO date string.",
    };
  }

  // headline
  if (typeof b.headline !== "string" || b.headline.trim().length === 0) {
    return {
      valid: false,
      error: "`headline` is required and must be a non-empty string.",
    };
  }
  if (b.headline.length > 200) {
    return {
      valid: false,
      error: "`headline` must be 200 characters or fewer.",
    };
  }

  // highlights
  if (
    !Array.isArray(b.highlights) ||
    b.highlights.length < 1 ||
    b.highlights.length > 10
  ) {
    return {
      valid: false,
      error: "`highlights` must be an array with 1–10 items.",
    };
  }
  if (!b.highlights.every((h) => typeof h === "string")) {
    return { valid: false, error: "`highlights` must be an array of strings." };
  }

  // metrics
  if (!b.metrics || typeof b.metrics !== "object" || Array.isArray(b.metrics)) {
    return { valid: false, error: "`metrics` must be an object." };
  }
  const m = b.metrics as Record<string, unknown>;
  if (!isNonNegativeInteger(m.prsShipped)) {
    return {
      valid: false,
      error: "`metrics.prsShipped` must be a non-negative integer.",
    };
  }
  if (!isNonNegativeInteger(m.testsPassing)) {
    return {
      valid: false,
      error: "`metrics.testsPassing` must be a non-negative integer.",
    };
  }
  if (!isNonNegativeInteger(m.featuresDelivered)) {
    return {
      valid: false,
      error: "`metrics.featuresDelivered` must be a non-negative integer.",
    };
  }

  // tags
  if (!Array.isArray(b.tags) || b.tags.length > 10) {
    return {
      valid: false,
      error: "`tags` must be an array with at most 10 items.",
    };
  }
  if (!b.tags.every((t) => typeof t === "string")) {
    return { valid: false, error: "`tags` must be an array of strings." };
  }

  return {
    valid: true,
    data: {
      weekEnding: b.weekEnding as string,
      headline: b.headline as string,
      highlights: b.highlights as string[],
      metrics: {
        prsShipped: m.prsShipped as number,
        testsPassing: m.testsPassing as number,
        featuresDelivered: m.featuresDelivered as number,
      },
      tags: b.tags as string[],
    },
  };
}

export async function POST(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  const ip = getClientIp(req);

  // Rate limit
  const rateResult = await checkGenericRateLimit(RATE_LIMIT_CONFIG, ip);
  if (rateResult.limited) {
    return Errors.rateLimited(rateResult.retryAfter ?? 60);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Errors.badRequest("Invalid JSON body.");
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return Errors.validationError(validation.error);
  }

  try {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const summary: ActivitySummary = {
      id,
      ...validation.data,
      createdAt,
    };

    const blobPath = `${ACTIVITY_PREFIX}${summary.weekEnding}-${id}.json`;
    await put(blobPath, JSON.stringify(summary), {
      access: "public",
      contentType: "application/json",
    });

    return apiSuccess(summary);
  } catch (error) {
    console.error("[api/v1/activity] Error storing activity summary:", error);
    return Errors.internalError("Failed to store activity summary.");
  }
}

export async function GET(req: Request) {
  const authResult = await requireApiKey(req);
  if (authResult instanceof Response) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(req.url);
    const rawLimit = parseInt(searchParams.get("limit") ?? "10", 10);
    const limit = isNaN(rawLimit) ? 10 : Math.min(Math.max(1, rawLimit), 52);

    const allBlobs: { pathname: string; url: string }[] = [];
    let cursor: string | undefined;
    do {
      const result = await list({
        prefix: ACTIVITY_PREFIX,
        cursor,
        limit: 1000,
      });
      allBlobs.push(...result.blobs);
      cursor = result.cursor ?? undefined;
    } while (cursor);

    // Fetch all blob contents
    const summaries: ActivitySummary[] = [];
    const fetchTimeout = 10000;

    const fetchResults = await Promise.allSettled(
      allBlobs.map(async (blob) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);
        try {
          const response = await fetch(blob.url, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return (await response.json()) as ActivitySummary;
        } finally {
          clearTimeout(timeoutId);
        }
      }),
    );

    for (const result of fetchResults) {
      if (result.status === "fulfilled") {
        summaries.push(result.value);
      }
    }

    // Sort by weekEnding descending
    summaries.sort((a, b) => {
      if (b.weekEnding < a.weekEnding) return -1;
      if (b.weekEnding > a.weekEnding) return 1;
      return 0;
    });

    return apiSuccess(summaries.slice(0, limit));
  } catch (error) {
    console.error("[api/v1/activity] Error listing activity summaries:", error);
    return Errors.internalError("Failed to list activity summaries.");
  }
}
