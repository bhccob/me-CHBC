import { describe, expect, it } from 'vitest';
import { localeFromPath, routeFromPath } from '../../src/i18n/locale';

describe('localeFromPath', () => {
  it('reads Dutch at the root', () => {
    expect(localeFromPath('/')).toBe('nl');
    expect(localeFromPath('/projects/jontai-energy/')).toBe('nl');
    expect(localeFromPath('/projects/jontai-energy/')).toBe('nl');
  });

  it('reads English under /en', () => {
    expect(localeFromPath('/en/')).toBe('en');
    expect(localeFromPath('/en')).toBe('en');
    expect(localeFromPath('/en/projects/jontai-energy/')).toBe('en');
  });

  it('does not take a longer first segment for English', () => {
    expect(localeFromPath('/english/')).toBe('nl');
    expect(localeFromPath('/enigma/')).toBe('nl');
  });
});

describe('routeFromPath', () => {
  it('drops the /en prefix, so both languages share one route', () => {
    expect(routeFromPath('/en/projects/jontai-energy/')).toBe('/projects/jontai-energy/');
    expect(routeFromPath('/projects/jontai-energy/')).toBe('/projects/jontai-energy/');
    expect(routeFromPath('/en/')).toBe('/');
    expect(routeFromPath('/en')).toBe('/');
    expect(routeFromPath('/')).toBe('/');
  });

  it('keeps a first segment that only starts with "en"', () => {
    expect(routeFromPath('/english/')).toBe('/english/');
  });

  it('ends the route in a slash', () => {
    expect(routeFromPath('/projects/jontai-energy')).toBe('/projects/jontai-energy/');
    expect(routeFromPath('/en/projects/jontai-energy')).toBe('/projects/jontai-energy/');
  });
});
