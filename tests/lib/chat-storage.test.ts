import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { loadSession, saveSession, clearSession, type StoredMessage } from '@/lib/chat-storage';

describe('chat-storage', () => {
  let localStorageMock: { [key: string]: string };
  let originalLocalStorage: Storage;

  beforeEach(() => {
    localStorageMock = {};
    originalLocalStorage = window.localStorage;

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn((key: string) => localStorageMock[key] ?? null),
        setItem: vi.fn((key: string, value: string) => {
          localStorageMock[key] = value;
        }),
        removeItem: vi.fn((key: string) => {
          delete localStorageMock[key];
        }),
        clear: vi.fn(() => {
          localStorageMock = {};
        }),
        length: 0,
        key: vi.fn(),
      },
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
    });
    vi.clearAllMocks();
  });

  describe('loadSession', () => {
    it('returns null when no data exists', () => {
      const result = loadSession();
      expect(result).toBeNull();
    });

    it('returns messages when valid data exists', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi there!' }] },
      ];

      const session = {
        messages,
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      const result = loadSession();
      expect(result).toEqual(messages);
    });

    it('returns null when session expired (>4 hours)', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Old message' }] },
      ];

      const fiveHoursAgo = Date.now() - (5 * 60 * 60 * 1000);
      const session = {
        messages,
        timestamp: fiveHoursAgo,
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(session);

      const result = loadSession();
      expect(result).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');
    });

    it('returns null and clears corrupted data', () => {
      localStorageMock['damilola-chat-session'] = 'not valid json {{{';

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');

      consoleSpy.mockRestore();
    });

    it('returns null for invalid message structure', () => {
      const invalidSession = {
        messages: [
          { id: '1', role: 'invalid_role', parts: [] }, // invalid role
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(invalidSession);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');

      consoleSpy.mockRestore();
    });

    it('returns null for missing parts array', () => {
      const invalidSession = {
        messages: [
          { id: '1', role: 'user' }, // missing parts
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(invalidSession);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });

    it('returns null for invalid part structure', () => {
      const invalidSession = {
        messages: [
          { id: '1', role: 'user', parts: [{ type: 'image', url: 'test.png' }] }, // not text type
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(invalidSession);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });
  });

  describe('saveSession', () => {
    it('stores messages to localStorage', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
      ];

      saveSession(messages);

      expect(window.localStorage.setItem).toHaveBeenCalledWith(
        'damilola-chat-session',
        expect.any(String)
      );

      const savedData = JSON.parse(localStorageMock['damilola-chat-session']);
      expect(savedData.messages).toEqual(messages);
      expect(savedData.timestamp).toBeDefined();
      expect(typeof savedData.timestamp).toBe('number');
    });

    it('stores multiple messages correctly', () => {
      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'First' }] },
        { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Second' }] },
        { id: '3', role: 'user', parts: [{ type: 'text', text: 'Third' }] },
      ];

      saveSession(messages);

      const savedData = JSON.parse(localStorageMock['damilola-chat-session']);
      expect(savedData.messages).toHaveLength(3);
      expect(savedData.messages[0].parts[0].text).toBe('First');
      expect(savedData.messages[1].parts[0].text).toBe('Second');
      expect(savedData.messages[2].parts[0].text).toBe('Third');
    });
  });

  describe('clearSession', () => {
    it('removes data from localStorage', () => {
      localStorageMock['damilola-chat-session'] = JSON.stringify({
        messages: [],
        timestamp: Date.now(),
      });

      clearSession();

      expect(window.localStorage.removeItem).toHaveBeenCalledWith('damilola-chat-session');
    });
  });

  describe('localStorage unavailable', () => {
    it('loadSession returns null when localStorage unavailable', () => {
      // Make localStorage throw
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: () => { throw new Error('QuotaExceededError'); },
          getItem: () => { throw new Error('SecurityError'); },
          removeItem: () => { throw new Error('SecurityError'); },
        },
        writable: true,
      });

      const result = loadSession();
      expect(result).toBeNull();
    });

    it('saveSession handles localStorage errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: () => { throw new Error('QuotaExceededError'); },
          getItem: vi.fn(() => '__storage_test__'),
          removeItem: vi.fn(),
        },
        writable: true,
      });

      const messages: StoredMessage[] = [
        { id: '1', role: 'user', parts: [{ type: 'text', text: 'Test' }] },
      ];

      // Should not throw
      expect(() => saveSession(messages)).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('clearSession handles localStorage errors gracefully', () => {
      Object.defineProperty(window, 'localStorage', {
        value: {
          setItem: vi.fn(),
          getItem: vi.fn(() => '__storage_test__'),
          removeItem: () => { throw new Error('SecurityError'); },
        },
        writable: true,
      });

      // Should not throw
      expect(() => clearSession()).not.toThrow();
    });
  });

  describe('validates message structure', () => {
    it('validates message has required id field', () => {
      const invalidSession = {
        messages: [
          { role: 'user', parts: [{ type: 'text', text: 'Hello' }] }, // missing id
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(invalidSession);

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = loadSession();
      expect(result).toBeNull();

      consoleSpy.mockRestore();
    });

    it('validates role is user or assistant', () => {
      const validSession = {
        messages: [
          { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
          { id: '2', role: 'assistant', parts: [{ type: 'text', text: 'Hi!' }] },
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(validSession);

      const result = loadSession();
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
    });

    it('validates parts contains text type with text string', () => {
      const validSession = {
        messages: [
          { id: '1', role: 'user', parts: [{ type: 'text', text: 'Hello' }] },
        ],
        timestamp: Date.now(),
      };

      localStorageMock['damilola-chat-session'] = JSON.stringify(validSession);

      const result = loadSession();
      expect(result).not.toBeNull();
      expect(result![0].parts[0].text).toBe('Hello');
    });
  });
});
