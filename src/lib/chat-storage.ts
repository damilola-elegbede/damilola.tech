/**
 * Chat session persistence with 4-hour TTL
 *
 * Stores chat messages in localStorage to survive page refreshes.
 * Sessions automatically expire after 4 hours of inactivity.
 */

const STORAGE_KEY = 'damilola-chat-session';
const SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

// Message format matching @ai-sdk/react useChat hook
interface MessagePart {
  type: 'text';
  text: string;
}

export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
}

interface StoredSession {
  messages: StoredMessage[];
  timestamp: number;
}

/**
 * Check if localStorage is available (handles SSR and private browsing)
 */
function isLocalStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, testKey);
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save chat messages to localStorage
 */
export function saveSession(messages: StoredMessage[]): void {
  if (!isLocalStorageAvailable()) return;

  const session: StoredSession = {
    messages,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    // Ignore quota exceeded or other storage errors
    console.warn('Failed to save chat session:', error);
  }
}

/**
 * Load chat messages from localStorage if session is still valid
 * Returns null if no session exists or session has expired
 */
export function loadSession(): StoredMessage[] | null {
  if (!isLocalStorageAvailable()) return null;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const session: StoredSession = JSON.parse(stored);
    const age = Date.now() - session.timestamp;

    if (age > SESSION_TTL_MS) {
      clearSession();
      return null;
    }

    return session.messages;
  } catch (error) {
    // If parsing fails, clear corrupted data
    console.warn('Failed to load chat session:', error);
    clearSession();
    return null;
  }
}

/**
 * Clear the stored chat session
 */
export function clearSession(): void {
  if (!isLocalStorageAvailable()) return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore errors
  }
}
