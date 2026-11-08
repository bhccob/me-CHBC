import type { JSX } from 'react';
import { profile } from '~/data/profile';
import { useTranslator } from '~/i18n/useTranslator';
import { NQ, THOUGHTS } from '~/journey/head/thoughts';

type TopicKey = 'plans' | 'career' | 'hobbies' | 'places' | 'skills' | 'site';

/**
 * The scanner's frame over Bob's head (spec 2026-11-08 "Into my head", sections 5.2 to 5.6 and 6; mock-up 20's `#hud`,
 * `#intro`, `#shade` and `#tint`): the violet glow, the shade behind an answer, the corners, the read-out, the ruler, the
 * side map, the six labels with their leaders, and the heading. Decoration: the words that matter are in HeadAnswers. The
 * page moves and fills it each frame (applyHead.ts).
 */
export function ScanHud(): JSX.Element {
  const { t } = useTranslator();
  const { head } = t.journey;
  return (
    <div className="j-hud" id="j-hud" aria-hidden="true">
      <div className="j-hud-glow" />
      <div className="j-hud-shade" />
      <svg className="j-hud-leads">
        {THOUGHTS.slice(0, NQ).map((thought) => (
          <g key={thought.key}>
            <path />
            <circle r="3" />
          </g>
        ))}
      </svg>
      {(['tl', 'tr', 'bl', 'br'] as const).map((corner) => (
        <i key={corner} className={`j-hud-corner ${corner}`} />
      ))}
      <div className="j-hud-readout">
        <p className="j-hud-title">{head.readout.title}</p>
        <p className="j-hud-row">
          <span>{head.readout.subject}</span>
          <b>{profile.name}</b>
        </p>
        <p className="j-hud-row">
          <span>{head.readout.status}</span>
          <b className="j-hud-status">—</b>
        </p>
        <p className="j-hud-row">
          <span>{head.readout.region}</span>
          <b className="j-hud-region">—</b>
        </p>
        <p className="j-hud-row">
          <span>{head.readout.doing}</span>
          <b className="j-hud-doing">—</b>
        </p>
        <div className="j-hud-meter">
          <i />
        </div>
      </div>
      <div className="j-hud-ruler">
        <i />
        <span />
      </div>
      <div className="j-hud-map">
        <canvas width={300} height={300} />
        <span>{head.sideMap}</span>
      </div>
      <div className="j-hud-labels">
        {THOUGHTS.slice(0, NQ).map((thought, k) => (
          <div key={thought.key} className="j-hud-label">
            <span>
              {String(k + 1).padStart(2, '0')}
              <span className="j-hud-long">{` · ${head.regions[thought.region]}`}</span>
            </span>
            <b>{head.topics[thought.key as TopicKey]}</b>
          </div>
        ))}
      </div>
      <div className="j-hud-intro">
        <p className="j-hud-eyebrow">{head.heading.eyebrow}</p>
        <p className="j-hud-heading">{head.heading.title}</p>
        <p className="j-hud-line">{head.heading.line}</p>
      </div>
    </div>
  );
}
