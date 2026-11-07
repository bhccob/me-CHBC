import { describe, expect, it } from 'vitest';
import { guardFrame } from '~/app/frameGuard';

const page = () => ({ style: { visibility: '' } });

describe('the site in someone else\'s frame', () => {
  it('leaves a page that is the whole window alone', () => {
    const win = { location: { href: 'https://bhccob.com/' } } as unknown as Window;
    Object.assign(win, { self: win, top: win });
    const root = page();
    expect(guardFrame(win, root)).toBe(false);
    expect(root.style.visibility).toBe('');
  });

  it('hides itself in a frame and asks to be the whole window', () => {
    const top = { location: { href: 'https://evil.example/' } };
    const win = { self: {}, top, location: { href: 'https://bhccob.com/contact/' } } as unknown as Window;
    const root = page();
    expect(guardFrame(win, root)).toBe(true);
    expect(root.style.visibility).toBe('hidden');
    expect(top.location.href).toBe('https://bhccob.com/contact/');
  });

  it('stays hidden where the framing page refuses to let go', () => {
    const top = {
      location: {
        set href(_url: string) {
          throw new Error('blocked');
        },
      },
    };
    const win = { self: {}, top, location: { href: 'https://bhccob.com/' } } as unknown as Window;
    const root = page();
    expect(guardFrame(win, root)).toBe(true);
    expect(root.style.visibility).toBe('hidden');
  });

  it('counts a frame whose top cannot even be read as a frame', () => {
    const win = {
      self: {},
      get top(): Window {
        throw new Error('cross-origin');
      },
      location: { href: 'https://bhccob.com/' },
    } as unknown as Window;
    const root = page();
    expect(guardFrame(win, root)).toBe(true);
    expect(root.style.visibility).toBe('hidden');
  });
});
