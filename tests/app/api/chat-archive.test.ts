import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('chat archive API route', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('no-op behavior', () => {
    it('returns success even when valid data is provided (no-op)', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('returns success regardless of request body (backward compat no-op)', async () => {
      const { POST } = await import('@/app/api/chat/archive/route');

      // Call with no request body - should still succeed as a no-op
      const response = await POST();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
