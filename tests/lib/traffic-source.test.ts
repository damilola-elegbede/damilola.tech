import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { classifyReferrer, captureTrafficSource } from '@/lib/traffic-source';

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

  describe('captureTrafficSource', () => {
    beforeEach(() => {
      // Reset window.location mock
      vi.stubGlobal('document', { referrer: '' });
    });

    it('captures UTM params on first visit', () => {
      // Mock window.location with UTM params
      vi.stubGlobal('window', {
        location: {
          search: '?utm_source=newsletter&utm_medium=email',
          pathname: '/',
        },
      });

      const result = captureTrafficSource();

      expect(result).not.toBeNull();
      expect(result!.source).toBe('newsletter');
      expect(result!.medium).toBe('email');
      expect(result!.landingPage).toBe('/');

      // Verify stored in localStorage
      const stored = JSON.parse(localStorageMock.getItem('audit_traffic_source')!);
      expect(stored.source).toBe('newsletter');
    });

    it('returns cached value when no UTM params present', () => {
      // Pre-populate localStorage
      const cached = {
        source: 'direct',
        medium: 'none',
        landingPage: '/',
        capturedAt: '2024-01-01T00:00:00.000Z',
      };
      localStorageMock.setItem('audit_traffic_source', JSON.stringify(cached));

      // Mock window.location without UTM params
      vi.stubGlobal('window', {
        location: {
          search: '',
          pathname: '/',
        },
      });

      const result = captureTrafficSource();

      expect(result).not.toBeNull();
      expect(result!.source).toBe('direct');
      expect(result!.capturedAt).toBe('2024-01-01T00:00:00.000Z');
    });

    it('overrides cached value when UTM params present', () => {
      // Pre-populate localStorage with direct visit
      const cached = {
        source: 'direct',
        medium: 'none',
        landingPage: '/',
        capturedAt: '2024-01-01T00:00:00.000Z',
      };
      localStorageMock.setItem('audit_traffic_source', JSON.stringify(cached));

      // Mock window.location WITH UTM params (shortlink redirect)
      vi.stubGlobal('window', {
        location: {
          search: '?utm_source=recruiter&utm_medium=verbal',
          pathname: '/',
        },
      });

      const result = captureTrafficSource();

      expect(result).not.toBeNull();
      expect(result!.source).toBe('recruiter');
      expect(result!.medium).toBe('verbal');
      // capturedAt should be updated (not the old cached timestamp)
      expect(result!.capturedAt).not.toBe('2024-01-01T00:00:00.000Z');

      // Verify localStorage was updated
      const stored = JSON.parse(localStorageMock.getItem('audit_traffic_source')!);
      expect(stored.source).toBe('recruiter');
      expect(stored.medium).toBe('verbal');
    });

    it('requires both source and medium for UTM override', () => {
      // Pre-populate localStorage
      const cached = {
        source: 'direct',
        medium: 'none',
        landingPage: '/',
        capturedAt: '2024-01-01T00:00:00.000Z',
      };
      localStorageMock.setItem('audit_traffic_source', JSON.stringify(cached));

      // Mock window.location with only utm_source (no medium)
      vi.stubGlobal('window', {
        location: {
          search: '?utm_source=partial',
          pathname: '/',
        },
      });

      const result = captureTrafficSource();

      // Should return cached value since UTM is incomplete
      expect(result!.source).toBe('direct');
    });

    it('captures direct traffic when no UTM and no cache', () => {
      // Mock window.location without UTM params
      vi.stubGlobal('window', {
        location: {
          search: '',
          pathname: '/',
        },
      });

      const result = captureTrafficSource();

      expect(result).not.toBeNull();
      expect(result!.source).toBe('direct');
      expect(result!.medium).toBe('none');
    });
  });
});
