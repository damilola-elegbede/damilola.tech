import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  logger,
  truncate,
  truncateStack,
  serializeError,
  logColdStartIfNeeded,
  resetColdStart,
  checkTimeoutWarning,
} from '@/lib/logger';
import { withRequestContext, getRequestContext } from '@/lib/request-context';

describe('logger', () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Reset environment
    delete process.env.LOG_LEVEL;
    resetColdStart();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  describe('truncate', () => {
    it('returns short strings unchanged', () => {
      expect(truncate('hello')).toBe('hello');
    });

    it('truncates long strings with ellipsis', () => {
      const longString = 'a'.repeat(600);
      const result = truncate(longString);
      expect(result.length).toBe(500);
      expect(result.endsWith('...')).toBe(true);
    });

    it('respects custom max length', () => {
      const result = truncate('hello world', 8);
      expect(result).toBe('hello...');
    });

    it('handles edge case of exactly max length', () => {
      const str = 'a'.repeat(500);
      expect(truncate(str)).toBe(str);
    });
  });

  describe('truncateStack', () => {
    it('returns undefined for undefined input', () => {
      expect(truncateStack(undefined)).toBeUndefined();
    });

    it('returns full stack in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
      const stack = `Error: test
    at fn1 (/path/file1.ts:10:5)
    at fn2 (/path/file2.ts:20:5)
    at fn3 (/path/file3.ts:30:5)
    at fn4 (/path/file4.ts:40:5)
    at fn5 (/path/file5.ts:50:5)
    at fn6 (/path/file6.ts:60:5)
    at fn7 (/path/file7.ts:70:5)`;

      const result = truncateStack(stack);
      expect(result).toBe(stack);
    });

    it('truncates to 5 frames in production', () => {
      vi.stubEnv('NODE_ENV', 'production');
      const stack = `Error: test
    at fn1 (/path/file1.ts:10:5)
    at fn2 (/path/file2.ts:20:5)
    at fn3 (/path/file3.ts:30:5)
    at fn4 (/path/file4.ts:40:5)
    at fn5 (/path/file5.ts:50:5)
    at fn6 (/path/file6.ts:60:5)
    at fn7 (/path/file7.ts:70:5)`;

      const result = truncateStack(stack);
      expect(result).toContain('Error: test');
      expect(result).toContain('fn1');
      expect(result).toContain('fn5');
      expect(result).not.toContain('fn6');
      expect(result).toContain('... 2 more frames');
    });
  });

  describe('serializeError', () => {
    it('returns undefined for falsy input', () => {
      expect(serializeError(null)).toBeUndefined();
      expect(serializeError(undefined)).toBeUndefined();
    });

    it('serializes Error objects', () => {
      const error = new Error('Test error');
      const result = serializeError(error);

      expect(result).toEqual({
        name: 'Error',
        message: 'Test error',
        stack: expect.any(String),
      });
    });

    it('serializes strings', () => {
      const result = serializeError('string error');
      expect(result).toEqual({
        name: 'Error',
        message: 'string error',
      });
    });

    it('truncates long error messages', () => {
      const longMessage = 'a'.repeat(600);
      const error = new Error(longMessage);
      const result = serializeError(error);

      expect(result?.message.length).toBe(500);
      expect(result?.message.endsWith('...')).toBe(true);
    });

    it('handles unknown types', () => {
      const result = serializeError({ foo: 'bar' });
      expect(result).toEqual({
        name: 'UnknownError',
        message: '[object Object]',
      });
    });
  });

  describe('log levels', () => {
    it('outputs valid JSON', () => {
      logger.info('test.event', { key: 'value' });

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('info');
      expect(parsed.event).toBe('test.event');
      expect(parsed.key).toBe('value');
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('sends errors to stderr', () => {
      logger.error('test.error', { message: 'failed' });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('respects LOG_LEVEL environment variable', () => {
      vi.stubEnv('LOG_LEVEL', 'warn');

      logger.debug('debug.message');
      logger.info('info.message');
      logger.warn('warn.message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0];
      expect(JSON.parse(output).event).toBe('warn.message');
    });

    it('filters debug logs in production by default', () => {
      vi.stubEnv('NODE_ENV', 'production');

      logger.debug('debug.message');
      logger.info('info.message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0];
      expect(JSON.parse(output).event).toBe('info.message');
    });
  });

  describe('request context propagation', () => {
    it('includes requestId and sessionId from context', () => {
      withRequestContext(
        {
          requestId: 'req-123',
          startTime: Date.now(),
          sessionId: 'sess-456',
        },
        () => {
          logger.info('test.event');
        }
      );

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.requestId).toBe('req-123');
      expect(parsed.sessionId).toBe('sess-456');
    });

    it('omits context fields when not available', () => {
      logger.info('test.event');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.requestId).toBeUndefined();
      expect(parsed.sessionId).toBeUndefined();
    });

    it('context is available in nested calls', () => {
      withRequestContext(
        {
          requestId: 'req-nested',
          startTime: Date.now(),
        },
        () => {
          const nestedFn = () => {
            logger.info('nested.event');
          };
          nestedFn();
        }
      );

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.requestId).toBe('req-nested');
    });
  });

  describe('request lifecycle helpers', () => {
    it('logs request.received with endpoint', () => {
      logger.request.received('/api/test', { method: 'POST' });

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.event).toBe('request.received');
      expect(parsed.endpoint).toBe('/api/test');
      expect(parsed.method).toBe('POST');
    });

    it('logs request.completed with duration', () => {
      const startTime = Date.now() - 150;
      logger.request.completed('/api/test', startTime);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.event).toBe('request.completed');
      expect(parsed.durationMs).toBeGreaterThanOrEqual(150);
    });

    it('logs request.failed with error and duration', () => {
      const startTime = Date.now() - 100;
      logger.request.failed('/api/test', startTime, new Error('failure'));

      const output = consoleErrorSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.event).toBe('request.failed');
      expect(parsed.durationMs).toBeGreaterThanOrEqual(100);
      expect(parsed.error.message).toBe('failure');
    });
  });

  describe('stream helpers', () => {
    it('logs stream.started', () => {
      logger.stream.started('/api/chat');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.event).toBe('stream.started');
      expect(parsed.endpoint).toBe('/api/chat');
    });

    it('logs stream.first_byte with timing', () => {
      const startTime = Date.now() - 250;
      logger.stream.firstByte(startTime);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.event).toBe('stream.first_byte');
      expect(parsed.timeToFirstByteMs).toBeGreaterThanOrEqual(250);
    });

    it('logs stream.completed with duration', () => {
      const startTime = Date.now() - 500;
      logger.stream.completed(startTime, { inputTokens: 100, outputTokens: 50 });

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.event).toBe('stream.completed');
      expect(parsed.durationMs).toBeGreaterThanOrEqual(500);
      expect(parsed.inputTokens).toBe(100);
    });
  });

  describe('cold start detection', () => {
    it('logs cold start only once', () => {
      logColdStartIfNeeded();
      logColdStartIfNeeded();
      logColdStartIfNeeded();

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.event).toBe('function.cold_start');
    });

    it('can be reset for testing', () => {
      logColdStartIfNeeded();
      resetColdStart();
      logColdStartIfNeeded();

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('timeout warning', () => {
    it('logs warning when approaching timeout', () => {
      const startTime = Date.now() - 51_000; // 51 seconds ago
      checkTimeoutWarning(startTime, '/api/chat');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.event).toBe('request.timeout_approaching');
      expect(parsed.endpoint).toBe('/api/chat');
      expect(parsed.elapsedMs).toBeGreaterThanOrEqual(51_000);
    });

    it('does not log when under threshold', () => {
      const startTime = Date.now() - 10_000; // 10 seconds ago
      checkTimeoutWarning(startTime, '/api/chat');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('specialized loggers', () => {
    it('logs anthropic rate limit', () => {
      logger.anthropic.rateLimited('60');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('warn');
      expect(parsed.event).toBe('anthropic.rate_limited');
      expect(parsed.retryAfter).toBe('60');
    });

    it('logs auth success', () => {
      logger.auth.success('password', { userId: 'admin' });

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('info');
      expect(parsed.event).toBe('auth.success');
      expect(parsed.method).toBe('password');
    });

    it('logs SSRF block', () => {
      logger.security.ssrfBlocked('192.168.1.1', 'http://internal/admin', 'private IP');

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('warn');
      expect(parsed.event).toBe('security.ssrf_blocked');
      expect(parsed.ip).toBe('192.168.1.1');
      expect(parsed.reason).toBe('private IP');
    });

    it('logs circuit breaker state changes', () => {
      logger.circuitBreaker.opened('rate-limiter', 5);

      const output = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);

      expect(parsed.level).toBe('warn');
      expect(parsed.event).toBe('circuit_breaker.opened');
      expect(parsed.name).toBe('rate-limiter');
      expect(parsed.failures).toBe(5);
    });
  });
});

describe('request-context', () => {
  it('getRequestContext returns undefined outside of withRequestContext', () => {
    expect(getRequestContext()).toBeUndefined();
  });

  it('getRequestContext returns context inside withRequestContext', () => {
    const ctx = {
      requestId: 'test-id',
      startTime: Date.now(),
      ip: '127.0.0.1',
    };

    withRequestContext(ctx, () => {
      expect(getRequestContext()).toEqual(ctx);
    });
  });

  it('context is isolated between calls', () => {
    withRequestContext({ requestId: 'first', startTime: 1 }, () => {
      expect(getRequestContext()?.requestId).toBe('first');
    });

    withRequestContext({ requestId: 'second', startTime: 2 }, () => {
      expect(getRequestContext()?.requestId).toBe('second');
    });
  });

  it('async operations preserve context', async () => {
    const result = await withRequestContext(
      { requestId: 'async-test', startTime: Date.now() },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return getRequestContext()?.requestId;
      }
    );

    expect(result).toBe('async-test');
  });
});
