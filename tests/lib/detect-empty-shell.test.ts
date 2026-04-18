/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  detectEmptyShell,
  resolvePreFetchedJobDescription,
} from '@/lib/job-description-input';

const FIXTURES_DIR = path.join(process.cwd(), 'tests', 'fixtures', 'jobs');

function loadFixture(file: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, file), 'utf8');
}

describe('detectEmptyShell', () => {
  it.each([
    'ashby-empty-shell.html',
    'workday-empty-shell.html',
    'spa-native-empty-shell.html',
  ])('returns true for %s', (file) => {
    expect(detectEmptyShell(loadFixture(file))).toBe(true);
  });

  it.each([
    'ashby-principal-infra.html',
    'greenhouse-staff-backend.html',
    'lever-senior-platform.html',
  ])('returns false for SSR-populated %s', (file) => {
    expect(detectEmptyShell(loadFixture(file))).toBe(false);
  });

  it('returns false for plain text input', () => {
    expect(detectEmptyShell('just a plain string, no html at all')).toBe(false);
  });

  it('returns false when body exceeds the visible-byte threshold even if a marker is present', () => {
    const html = [
      '<!doctype html><html><body>',
      '<div id="__next">',
      // >50 bytes of visible content — should not be treated as empty shell
      '<h1>Staff Backend Engineer</h1><p>Responsibilities include leading a team of distributed systems engineers building global infrastructure.</p>',
      '</div></body></html>',
    ].join('');
    expect(detectEmptyShell(html)).toBe(false);
  });
});

describe('resolvePreFetchedJobDescription — empty-shell fallback', () => {
  it.each([
    'ashby-empty-shell.html',
    'workday-empty-shell.html',
    'spa-native-empty-shell.html',
  ])(
    'returns isEmptyShell=true for %s without throwing',
    (file) => {
      const html = loadFixture(file);
      const resolved = resolvePreFetchedJobDescription(
        html,
        'https://example.com/jobs/test'
      );
      expect(resolved.isEmptyShell).toBe(true);
      expect(resolved.extractedUrl).toBe('https://example.com/jobs/test');
      expect(resolved.inputType).toBe('content');
    }
  );

  it('still throws for short non-shell pre-fetched content', () => {
    const tiny = '<html><body><p>too short</p></body></html>';
    expect(() =>
      resolvePreFetchedJobDescription(tiny, 'https://example.com/jobs/x')
    ).toThrow(/too short/i);
  });
});
