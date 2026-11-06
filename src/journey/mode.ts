/** Which journey a visitor gets. Pure. */

export type JourneyMode = 'live' | 'calm' | 'lite-link';

export function journeyMode({ webgl, reduced, failed }: { webgl: 'ok' | 'none' | 'software'; reduced: boolean; failed: boolean }): JourneyMode {
  if (failed || webgl !== 'ok') return 'lite-link';
  return reduced ? 'calm' : 'live';
}
