import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { classifyReferrer } from '@/lib/traffic-source';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

describe('traffic-source', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', localStorageMock);
    localStorageMock.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('classifyReferrer', () => {
    it('returns "direct" for empty referrer', () => {
      expect(classifyReferrer('')).toBe('direct');
    });

    it('classifies google.com as google', () => {
      expect(classifyReferrer('https://www.google.com/search?q=test')).toBe('google');
      expect(classifyReferrer('https://google.com/')).toBe('google');
    });

    it('classifies google.co.uk as google', () => {
      expect(classifyReferrer('https://www.google.co.uk/search?q=test')).toBe('google');
    });

    it('classifies linkedin.com as linkedin', () => {
      expect(classifyReferrer('https://www.linkedin.com/in/someone')).toBe('linkedin');
      expect(classifyReferrer('https://linkedin.com/feed')).toBe('linkedin');
    });

    it('classifies twitter.com as twitter', () => {
      expect(classifyReferrer('https://twitter.com/someone')).toBe('twitter');
    });

    it('classifies x.com as twitter', () => {
      expect(classifyReferrer('https://x.com/someone')).toBe('twitter');
    });

    it('classifies github.com as github', () => {
      expect(classifyReferrer('https://github.com/user/repo')).toBe('github');
    });

    it('classifies bing.com as bing', () => {
      expect(classifyReferrer('https://www.bing.com/search?q=test')).toBe('bing');
    });

    it('classifies facebook.com as facebook', () => {
      expect(classifyReferrer('https://www.facebook.com/')).toBe('facebook');
    });

    it('returns domain name for unknown sources', () => {
      expect(classifyReferrer('https://medium.com/article')).toBe('medium.com');
      expect(classifyReferrer('https://news.ycombinator.com/')).toBe('news.ycombinator.com');
    });

    it('strips www prefix from domain', () => {
      expect(classifyReferrer('https://www.example.com/')).toBe('example.com');
    });

    it('returns "unknown" for invalid URLs', () => {
      expect(classifyReferrer('not-a-url')).toBe('unknown');
    });

    it('handles subdomains of known sources', () => {
      expect(classifyReferrer('https://mail.google.com/')).toBe('google');
      expect(classifyReferrer('https://mobile.twitter.com/')).toBe('twitter');
    });
  });
});
