import type { RouteConfigEntry } from '@react-router/dev/routes';
import { afterEach, describe, expect, it, vi } from 'vitest';

// LAB ONLY (throwaway): the opening's previews exist only in a LAB=1 server, and are never a page of the site.
async function routesWith(lab: string): Promise<RouteConfigEntry[]> {
  vi.stubEnv('LAB', lab);
  vi.resetModules();
  return await (await import('../../src/app/routes')).default;
}

describe('the lab route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is not routed without LAB=1', async () => {
    const routes = await routesWith('');
    expect(routes.some((entry) => entry.file === 'routes/lab.tsx')).toBe(false);
  });

  it('is routed at /lab/:id with LAB=1, before the catch-all, and never prerendered or in the sitemap', async () => {
    const routes = await routesWith('1');
    const lab = routes.find((entry) => entry.file === 'routes/lab.tsx');
    expect(lab?.path).toBe('lab/:id');
    expect(routes.at(-1)?.path).toBe('*');
    const { pagePaths } = await import('../../src/data/pages');
    expect(pagePaths().some((path) => path.includes('lab'))).toBe(false);
  });
});
