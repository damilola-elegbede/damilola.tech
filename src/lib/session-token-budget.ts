/**
 * Per-session token budget enforcement.
 *
 * Tracks cumulative input token spend per chat session within a rolling 24-hour
 * window. Complements IP-based rate limiting with a content-volume control that
 * is harder for attackers to reset by rotating IPs.
 *
 * Storage: Upstash Redis when configured (production), in-memory fallback (dev).
 * Budget: SESSION_TOKEN_BUDGET_DAILY input tokens per session per 24 hours.
 */

import { Redis } from '@upstash/redis';

/** Maximum input tokens a single session may consume in a 24-hour window. */
export const SESSION_TOKEN_BUDGET_DAILY = 50_000;

const BUDGET_WINDOW_SECONDS = 24 * 60 * 60; // 24 hours

// ── Redis path ────────────────────────────────────────────────────────────────

const useRedis = !!(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let _redis: Redis | null = null;
function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

function redisKey(sessionId: string): string {
  return `session_token_budget:${sessionId}`;
}

// ── In-memory fallback ────────────────────────────────────────────────────────

interface BudgetEntry {
  tokens: number;
  expiresAt: number; // ms epoch
}

const memStore = new Map<string, BudgetEntry>();

function memGet(sessionId: string): number {
  const entry = memStore.get(sessionId);
  if (!entry) return 0;
  if (Date.now() > entry.expiresAt) {
    memStore.delete(sessionId);
    return 0;
  }
  return entry.tokens;
}

function memAdd(sessionId: string, tokens: number): number {
  const existing = memStore.get(sessionId);
  const now = Date.now();
  if (!existing || now > existing.expiresAt) {
    const entry: BudgetEntry = {
      tokens,
      expiresAt: now + BUDGET_WINDOW_SECONDS * 1000,
    };
    memStore.set(sessionId, entry);
    return tokens;
  }
  existing.tokens += tokens;
  return existing.tokens;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface TokenBudgetResult {
  /** true when the session has exhausted its daily budget */
  exceeded: boolean;
  /** tokens consumed so far this window */
  consumed: number;
  /** budget ceiling */
  limit: number;
}

/**
 * Check whether a session's token budget has already been exceeded.
 * Call this BEFORE dispatching to the Anthropic API.
 */
export async function checkSessionTokenBudget(
  sessionId: string
): Promise<TokenBudgetResult> {
  try {
    let consumed: number;
    if (useRedis) {
      const raw = await getRedis().get<number>(redisKey(sessionId));
      consumed = raw ?? 0;
    } else {
      consumed = memGet(sessionId);
    }
    return { exceeded: consumed >= SESSION_TOKEN_BUDGET_DAILY, consumed, limit: SESSION_TOKEN_BUDGET_DAILY };
  } catch (err) {
    // Fail open — don't block legitimate traffic on budget check errors
    console.warn('[session-token-budget] checkSessionTokenBudget error (fail open):', err);
    return { exceeded: false, consumed: 0, limit: SESSION_TOKEN_BUDGET_DAILY };
  }
}

/**
 * Record input tokens consumed by a completed request.
 * Call this AFTER a successful Anthropic API response.
 */
export async function recordSessionTokens(
  sessionId: string,
  inputTokens: number
): Promise<void> {
  if (inputTokens <= 0) return;
  try {
    if (useRedis) {
      const key = redisKey(sessionId);
      const redis = getRedis();
      // INCRBY is atomic; set TTL only when the key is new
      const newTotal = await redis.incrby(key, inputTokens);
      if (newTotal === inputTokens) {
        // Key was just created — set the 24-hour expiry
        await redis.expire(key, BUDGET_WINDOW_SECONDS);
      }
    } else {
      memAdd(sessionId, inputTokens);
    }
  } catch (err) {
    // Non-fatal — logging is best-effort
    console.warn('[session-token-budget] recordSessionTokens error:', err);
  }
}
