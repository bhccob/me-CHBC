import { projects } from '~/data/projects';
import type { Locale } from '~/i18n/Translator';
import { translatorFor } from '~/i18n/useTranslator';

/**
 * What pours into Bob's head (spec 2026-11-08 "Into my head", section 5.4): what the visitor has just seen on the way, the
 * four fields, every project, where he is from, and a few lines of code. From the data, so a new project shows up here
 * with no new code. Code reads the same in both languages.
 */

export const CODE_LINES = ['const bob = new Engineer()', 'SELECT * FROM ideas;', 'firmware.flash()', 'git commit -m "next"', 'while (learning) build();'] as const;

export function pourWords(locale: Locale): { text: string; mono: boolean }[] {
  const { t } = translatorFor(locale);
  const { labels } = t.journey.stack;
  const words = [labels.brain.field, labels.controls.field, labels.armour.field, labels.body.field, ...projects.byDate().map((project) => project.title), t.journey.head.pourPlace, 'TypeScript', 'React · Three.js', 'Blender'];
  const out: { text: string; mono: boolean }[] = [];
  for (let i = 0; i < Math.max(words.length, CODE_LINES.length); i++) {
    if (i < words.length) out.push({ text: words[i], mono: false });
    if (i < CODE_LINES.length) out.push({ text: CODE_LINES[i], mono: true });
  }
  return out;
}
