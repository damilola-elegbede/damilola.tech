/**
 * Request context propagation via AsyncLocalStorage
 *
 * Provides request-scoped context (requestId, sessionId, etc.) that is
 * automatically available to all code running within a request handler,
 * including async callbacks and fire-and-forget operations.
 *
 * Usage:
 * ```typescript
 * export async function POST(req: Request) {
 *   return withRequestContext({
 *     requestId: crypto.randomUUID(),
 *     startTime: Date.now(),
 *     ip: getClientIp(req),
 *   }, async () => {
 *     // Context is automatically available here and in all nested calls
 *     logger.info('request.received', { endpoint: '/api/chat' });
 *     // ...
 *   });
 * }
 * ```
 */

import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  /** Unique identifier for this request */
  requestId: string;

  /** Request start timestamp (ms since epoch) */
  startTime: number;

  /** Session ID if available */
  sessionId?: string;

  /** Client IP address */
  ip?: string;

  /** User agent string */
  userAgent?: string;

  /** Endpoint being accessed */
  endpoint?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current request context
 * Returns undefined if called outside of withRequestContext
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Run a function with the given request context
 * All code within the callback (including async operations) will have access to the context
 */
export function withRequestContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Update the current request context with additional fields
 * Useful for adding sessionId after authentication
 */
export function updateRequestContext(updates: Partial<RequestContext>): void {
  const current = getRequestContext();
  if (current) {
    Object.assign(current, updates);
  }
}

/**
 * Extract client IP from request headers
 * Handles Vercel's x-forwarded-for header
 */
export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, first is the client
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || undefined;
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(req: Request): string | undefined {
  return req.headers.get('user-agent') || undefined;
}

/**
 * Create a request context from a Request object
 */
export function createRequestContext(req: Request, endpoint: string): RequestContext {
  return {
    requestId: crypto.randomUUID(),
    startTime: Date.now(),
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
    endpoint,
  };
}

/**
 * Capture the current context for use in fire-and-forget operations
 *
 * When you need to log from a detached async operation (like .catch() handlers),
 * capture the context first, then use it in the callback.
 *
 * Example:
 * ```typescript
 * const ctx = captureContext();
 * saveToBlob(...).catch(err =>
 *   logger.warn('blob.save_failed', { requestId: ctx?.requestId, error: err.message })
 * );
 * ```
 */
export function captureContext(): RequestContext | undefined {
  return getRequestContext();
}
