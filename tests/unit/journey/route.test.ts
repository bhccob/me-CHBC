import type { RouteConfigEntry } from '@react-router/dev/routes';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleOf, HANDLES } from '../../../src/app/handle';

const slashed = (path: string): string => `/${path}/`.replace(/\/+/g, '/');

function urlPaths(entries: readonly RouteConfigEntry[]): string[] {
  return entries.flatMap((entry) => (entry.index ? ['/'] : entry.path ? [slashed(entry.path)] : []));
}

/** The site's routes as they read with this value of JOURNEY, built afresh. */
async function pathsWith(value: string | undefined): Promise<string[]> {
  vi.resetModules();
  vi.stubEnv('JOURNEY', value ?? '');
  const routes = (await import('../../../src/app/routes')).default;
  return urlPaths(await routes);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('the review route, beside the old home until the swap', () => {
  it('has no review route by default', async () => {
    expect(await pathsWith(undefined)).not.toContain('/journey/');
  });

  it('has both review routes with JOURNEY=1', async () => {
    const paths = await pathsWith('1');
    expect(paths).toContain('/journey/');
    expect(paths).toContain('/en/journey/');
  });

  it('gives the review route its own handle and no old scene', () => {
    expect(handleOf([{ handle: HANDLES.journey, pathname: '/journey/' }])).toEqual({ route: 'journey', scene: null });
    expect(handleOf([{ handle: HANDLES.journey, pathname: '/en/journey/' }])).toEqual({ route: 'journey', scene: null });
  });
});
