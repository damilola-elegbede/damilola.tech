/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';

describe('score_resume compatibility API route', () => {
  it('re-exports POST from the v1 score-resume route', async () => {
    const compatRoute = await import('@/app/api/score_resume/route');
    const v1Route = await import('@/app/api/v1/score-resume/route');

    expect(compatRoute.runtime).toBe('nodejs');
    expect(v1Route.runtime).toBe('nodejs');
    expect(compatRoute.POST).toBe(v1Route.POST);
  });
});
