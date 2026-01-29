import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock stream for Anthropic
const mockStream = {
  [Symbol.asyncIterator]: async function* () {
    yield {
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'Hello' },
    };
  },
  finalMessage: () =>
    Promise.resolve({
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    }),
};

// Mock Anthropic client using class pattern
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      stream: vi.fn().mockReturnValue(mockStream),
    };
  },
}));

// Mock system prompt
vi.mock('@/lib/generated/system-prompt', () => ({
  CHATBOT_SYSTEM_PROMPT: 'Test system prompt',
}));

// Mock chat storage
const mockSaveConversation = vi.fn();
vi.mock('@/lib/chat-storage-server', () => ({
  saveConversationToBlob: mockSaveConversation,
}));

// Mock chat compaction
vi.mock('@/lib/chat-compaction', () => ({
  compactConversation: vi.fn().mockImplementation(async (messages) => ({
    messages,
    wasCompacted: false,
    originalCount: messages.length,
  })),
}));

// Mock rate limit
vi.mock('@/lib/rate-limit', () => ({
  checkGenericRateLimit: vi.fn().mockResolvedValue({ limited: false }),
  createRateLimitResponse: vi.fn(),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
  RATE_LIMIT_CONFIGS: { chat: {} },
}));

// Mock usage logger
vi.mock('@/lib/usage-logger', () => ({
  logUsage: vi.fn().mockResolvedValue(undefined),
}));

describe('chat API session validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('session ID format validation', () => {
    it('accepts chat-prefixed session IDs', async () => {
      const { POST } = await import('@/app/api/chat/route');

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          sessionId: 'chat-a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          sessionStartedAt: '2025-01-22T10:30:00.000Z',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // Consume the stream to trigger conversation save
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      // Wait for async save
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify conversation was saved (validation passed)
      expect(mockSaveConversation).toHaveBeenCalled();
    });

    it('rejects plain UUID session IDs (does not save)', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const { POST } = await import('@/app/api/chat/route');

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', // Plain UUID - should fail
          sessionStartedAt: '2025-01-22T10:30:00.000Z',
        }),
      });

      const response = await POST(request);

      expect(response.status).toBe(200); // Request still succeeds, just doesn't save

      // Consume the stream
      const reader = response.body?.getReader();
      if (reader) {
        while (true) {
          const { done } = await reader.read();
          if (done) break;
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Verify conversation was NOT saved (validation failed)
      expect(mockSaveConversation).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('logs error when sessionId format is invalid', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const { POST } = await import('@/app/api/chat/route');

      const request = new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          sessionId: 'invalid-session-id',
          sessionStartedAt: '2025-01-22T10:30:00.000Z',
        }),
      });

      await POST(request);

      // Verify validation error was logged
      expect(consoleSpy).toHaveBeenCalled();
      const errorCall = consoleSpy.mock.calls.find(
        (call) =>
          call[0] &&
          typeof call[0] === 'string' &&
          call[0].includes('session_validation_error')
      );
      expect(errorCall).toBeDefined();

      const loggedError = JSON.parse(errorCall![0] as string);
      expect(loggedError.type).toBe('session_validation_error');
      expect(loggedError.error).toBe('invalid_session_id_format');
      expect(loggedError.expectedPattern).toBe('chat-{uuid}');

      consoleSpy.mockRestore();
    });
  });
});
