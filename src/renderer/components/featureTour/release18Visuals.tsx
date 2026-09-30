/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId } from 'react';
import type { TranslationKey } from '../../../common/i18n';
import { useTranslation } from '../../utils/I18nContext';

/**
 * The pictures on 2.0's headline slides (prepared as 1.8, hence the file's
 * name): the app's own pages in miniature, drawn with the app's own words in
 * the reader's language. Each is composed to be about as tall as it is wide,
 * the shape the slide gives it beside the text. The presets picker, drawn
 * with the genre notes' own parts,
 * is in `PresetsVisual.tsx`; the Compact player's in
 * `CompactPlayerVisual.tsx`; games in `GameStoryVisual.tsx`; the new look,
 * the graph's views and the Studio, photographed, in `release20Visuals.tsx`.
 */

/** Where the three thirds sit on the graph, in its 0..1 width. */
const THIRDS: { key: TranslationKey; from: number; to: number }[] = [
  { key: 'eq.tone.bass', from: 0, to: 0.3 },
  { key: 'eq.tone.mid', from: 0.3, to: 0.7 },
  { key: 'eq.tone.treble', from: 0.7, to: 1 },
];

const KNOBS: { key: TranslationKey; db: number }[] = [
  { key: 'eq.tone.bass', db: 4.5 },
  { key: 'eq.tone.mid', db: 0 },
  { key: 'eq.tone.treble', db: 3 },
];

const LAYOUTS = [6, 10, 15, 20, 31];
const NEW_LAYOUT = 20;

/**
 * The curve the three knobs make: Bass up by its dial, the middle flat,
 * Treble up by its dial, the joins as smooth as shelves are. Points on a
 * 0..100 box, gain up.
 */
const toneCurve = (() => {
  const points: string[] = [];
  for (let step = 0; step <= 60; step += 1) {
    const x = step / 60;
    const bass = 4.5 / (1 + Math.exp((x - 0.28) * 22));
    const treble = 3 / (1 + Math.exp(-(x - 0.74) * 22));
    const y = 50 - (bass + treble) * 6;
    points.push(`${(x * 100).toFixed(2)},${y.toFixed(2)}`);
  }
  return points.join(' ');
})();

/** A dial's angle for a gain, on the same ±12 dB the tone dials turn over. */
const dialAngle = (db: number) => (db / 12) * 135;

/** A point on a dial's ring, `degrees` clockwise from straight up. */
const onRing = (degrees: number, radius: number) => {
  const radians = (degrees * Math.PI) / 180;
  return `${(20 + radius * Math.sin(radians)).toFixed(2)} ${(
    20 -
    radius * Math.cos(radians)
  ).toFixed(2)}`;
};

/** The ring's arc between two angles, drawn clockwise. */
const ringArc = (from: number, to: number, radius: number) => {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const large = end - start > 180 ? 1 : 0;
  return `M ${onRing(start, radius)} A ${radius} ${radius} 0 ${large} 1 ${onRing(end, radius)}`;
};

/** The curve in its three thirds, the three knobs, the quick layouts. */
export function ToneVisual() {
  const { t } = useTranslation();
  // The fill under the curve fades to nothing, and SVG gradients are found
  // by id across the whole document.
  const fade = useId();
  return (
    <div
      className="tone-visual"
      role="img"
      aria-label={t('tour.tone.imageAlt')}
    >
      <div className="tone-visual__graph">
        {THIRDS.map((third) => (
          <span
            key={third.key}
            className="tone-visual__third"
            style={{
              left: `${third.from * 100}%`,
              width: `${(third.to - third.from) * 100}%`,
            }}
          >
            {t(third.key)}
          </span>
        ))}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={fade} x1="0" y1="0" x2="0" y2="1">
              <stop className="tone-visual__fade-top" offset="0" />
              <stop className="tone-visual__fade-bottom" offset="1" />
            </linearGradient>
          </defs>
          <line className="tone-visual__zero" x1="0" y1="50" x2="100" y2="50" />
          <polyline
            className="tone-visual__fill"
            points={`0,100 ${toneCurve} 100,100`}
            fill={`url(#${fade})`}
          />
          <polyline className="tone-visual__curve" points={toneCurve} />
        </svg>
      </div>

      <div className="tone-visual__controls">
        <ul className="tone-visual__knobs">
          {KNOBS.map((knob) => (
            <li key={knob.key}>
              <svg viewBox="0 0 40 40" aria-hidden="true">
                <path
                  className="tone-visual__track"
                  d={ringArc(-135, 135, 16)}
                />
                {knob.db !== 0 && (
                  <path
                    className="tone-visual__value"
                    d={ringArc(0, dialAngle(knob.db), 16)}
                  />
                )}
                <circle className="tone-visual__cap" cx="20" cy="20" r="11" />
                <line
                  className="tone-visual__needle"
                  x1="20"
                  y1="17"
                  x2="20"
                  y2="11"
                  transform={`rotate(${dialAngle(knob.db)} 20 20)`}
                />
              </svg>
              <strong>{t(knob.key)}</strong>
              <span>{`${knob.db > 0 ? '+' : ''}${knob.db.toFixed(1)} dB`}</span>
            </li>
          ))}
        </ul>
        <div className="tone-visual__layouts">
          <span className="tone-visual__caption">{t('eq.quickLayouts')}</span>
          <ul>
            {LAYOUTS.map((count) => (
              <li
                key={count}
                className={count === NEW_LAYOUT ? 'is-new' : undefined}
              >
                {t('eq.bandCount', { count })}
                {count === NEW_LAYOUT && <em>{t('tour.newBadge')}</em>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export { default as GuideVisual } from './GuideVisual';
