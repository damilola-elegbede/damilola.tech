/**
 * Structured logger for Vercel serverless environment
 *
 * Features:
 * - JSON output for structured log aggregation
 * - Log levels with environment-based filtering
 * - Request ID correlation via AsyncLocalStorage
 * - Stack trace truncation in production
 * - Duration tracking helpers
 */

import { getRequestContext } from './request-context';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  timestamp: string;
  event: string;
  requestId?: string;
  sessionId?: string;
  [key: string]: unknown;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MAX_MESSAGE_LENGTH = 500;
const MAX_STACK_FRAMES_PROD = 5;

function getLogLevel(): LogLevel {
  const envLevel = process.env.LOG_LEVEL?.toLowerCase();
  if (envLevel && envLevel in LOG_LEVELS) {
    return envLevel as LogLevel;
  }
  // Default to 'info' in production, 'debug' in development
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  const currentLevel = getLogLevel();
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
}

/**
 * Truncate a string to the specified max length
 */
export function truncate(str: string, maxLength: number = MAX_MESSAGE_LENGTH): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate stack trace to N frames in production
 */
export function truncateStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;

  if (process.env.NODE_ENV !== 'production') {
    return stack;
  }

  const lines = stack.split('\n');
  const errorLine = lines[0];
  const stackFrames = lines.slice(1, MAX_STACK_FRAMES_PROD + 1);

  if (lines.length > MAX_STACK_FRAMES_PROD + 1) {
    stackFrames.push(`    ... ${lines.length - MAX_STACK_FRAMES_PROD - 1} more frames`);
  }

  return [errorLine, ...stackFrames].join('\n');
}

/**
 * Serialize an error for logging
 */
export function serializeError(
  error: unknown
): { name: string; message: string; stack?: string } | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    return {
      name: error.name,
      message: truncate(error.message),
      stack: truncateStack(error.stack),
    };
  }

  if (typeof error === 'string') {
    return {
      name: 'Error',
      message: truncate(error),
    };
  }

  return {
    name: 'UnknownError',
    message: truncate(String(error)),
  };
}

/**
 * Core logging function
 */
function log(level: LogLevel, event: string, data: Record<string, unknown> = {}): void {
  if (!shouldLog(level)) return;

  const ctx = getRequestContext();

  // Handle error serialization
  const processedData = { ...data };
  if (processedData.error) {
    processedData.error = serializeError(processedData.error);
  }

  const entry: LogEntry = {
    level,
    timestamp: new Date().toISOString(),
    event,
    ...(ctx?.requestId && { requestId: ctx.requestId }),
    ...(ctx?.sessionId && { sessionId: ctx.sessionId }),
    ...processedData,
  };

  const output = JSON.stringify(entry);

  // Use stderr for errors, stdout for everything else
  if (level === 'error') {
    console.error(output);
  } else {
    console.log(output);
  }
}

/**
 * Cold start detection
 */
let isColdStart = true;

export function logColdStartIfNeeded(): void {
  if (isColdStart) {
    log('info', 'function.cold_start', {
      region: process.env.VERCEL_REGION,
      nodeVersion: process.version,
    });
    isColdStart = false;
  }
}

/**
 * Reset cold start flag (for testing)
 */
export function resetColdStart(): void {
  isColdStart = true;
}

/**
 * Check if approaching Vercel timeout (50s of 60s limit)
 */
const TIMEOUT_WARN_MS = 50_000;

export function checkTimeoutWarning(startTime: number, endpoint: string): void {
  const elapsed = Date.now() - startTime;
  if (elapsed > TIMEOUT_WARN_MS) {
    log('warn', 'request.timeout_approaching', {
      endpoint,
      elapsedMs: elapsed,
      limitMs: 60_000,
    });
  }
}

/**
 * Logger interface with level-specific methods
 */
export const logger = {
  debug: (event: string, data?: Record<string, unknown>) => log('debug', event, data),
  info: (event: string, data?: Record<string, unknown>) => log('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => log('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => log('error', event, data),

  /**
   * Log request lifecycle with automatic duration calculation
   */
  request: {
    received: (endpoint: string, data?: Record<string, unknown>) =>
      log('info', 'request.received', { endpoint, ...data }),

    completed: (endpoint: string, startTime: number, data?: Record<string, unknown>) =>
      log('info', 'request.completed', {
        endpoint,
        durationMs: Date.now() - startTime,
        ...data,
      }),

    failed: (endpoint: string, startTime: number, error: unknown, data?: Record<string, unknown>) =>
      log('error', 'request.failed', {
        endpoint,
        durationMs: Date.now() - startTime,
        error,
        ...data,
      }),
  },

  /**
   * Log streaming events
   */
  stream: {
    started: (endpoint: string, data?: Record<string, unknown>) =>
      log('info', 'stream.started', { endpoint, ...data }),

    firstByte: (startTime: number, data?: Record<string, unknown>) =>
      log('info', 'stream.first_byte', {
        timeToFirstByteMs: Date.now() - startTime,
        ...data,
      }),

    completed: (startTime: number, data?: Record<string, unknown>) =>
      log('info', 'stream.completed', {
        durationMs: Date.now() - startTime,
        ...data,
      }),

    error: (startTime: number, error: unknown, data?: Record<string, unknown>) =>
      log('error', 'stream.error', {
        durationMs: Date.now() - startTime,
        error,
        ...data,
      }),
  },

  /**
   * Log Anthropic API interactions
   */
  anthropic: {
    rateLimited: (retryAfter?: string) =>
      log('warn', 'anthropic.rate_limited', { retryAfter }),

    serverError: (status: number, message: string) =>
      log('error', 'anthropic.server_error', { status, message: truncate(message) }),

    apiError: (status: number, message: string) =>
      log('error', 'anthropic.api_error', { status, message: truncate(message) }),

    usage: (data: {
      inputTokens: number;
      outputTokens: number;
      cacheReadTokens?: number;
      cacheCreationTokens?: number;
      costUsd?: number;
    }) => log('info', 'anthropic.usage', data),
  },

  /**
   * Log authentication events
   */
  auth: {
    success: (method: string, data?: Record<string, unknown>) =>
      log('info', 'auth.success', { method, ...data }),

    failure: (method: string, reason: string, data?: Record<string, unknown>) =>
      log('warn', 'auth.failure', { method, reason, ...data }),

    error: (method: string, error: unknown, data?: Record<string, unknown>) =>
      log('error', 'auth.error', { method, error, ...data }),
  },

  /**
   * Log security events
   */
  security: {
    ssrfBlocked: (ip: string, url: string, reason: string) =>
      log('warn', 'security.ssrf_blocked', { ip, url: truncate(url), reason }),

    rateLimitTriggered: (ip: string, endpoint: string, data?: Record<string, unknown>) =>
      log('warn', 'security.rate_limit_triggered', { ip, endpoint, ...data }),

    largePayloadRejected: (ip: string, contentLength: number, maxAllowed: number) =>
      log('warn', 'security.large_payload_rejected', { ip, contentLength, maxAllowed }),

    csrfFailure: (ip: string, reason: string) =>
      log('warn', 'security.csrf_failure', { ip, reason }),
  },

  /**
   * Log blob storage events
   */
  blob: {
    readSuccess: (path: string, durationMs: number) =>
      log('debug', 'blob.read_success', { path, durationMs }),

    readFailure: (path: string, error: unknown) =>
      log('error', 'blob.read_failure', { path, error }),

    writeSuccess: (path: string, durationMs: number) =>
      log('info', 'blob.write_success', { path, durationMs }),

    writeFailure: (path: string, error: unknown) =>
      log('error', 'blob.write_failure', { path, error }),
  },

  /**
   * Log circuit breaker events
   */
  circuitBreaker: {
    opened: (name: string, failures: number) =>
      log('warn', 'circuit_breaker.opened', { name, failures }),

    halfOpen: (name: string) => log('info', 'circuit_breaker.half_open', { name }),

    closed: (name: string) => log('info', 'circuit_breaker.closed', { name }),

    rejected: (name: string) => log('warn', 'circuit_breaker.rejected', { name }),
  },
};

export type Logger = typeof logger;
