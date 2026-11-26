/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, type CSSProperties } from 'react';
import { PRODUCT_NAME } from 'common/branding';
import { buildWordmark } from './wordmarkPen';

/** The word, swept by the pen once, when the module loads. */
export const WORDMARK_SHAPE = buildWordmark();

/**
 * How far before the word, in lettering units, its gradient starts: the
 * logo's 44px and the 8px gap after it, at the header's 36px-tall word, so
 * the run begins at the logo's left edge (measured: x 17 against the logo's
 * 18). The logo is the first stretch of the same run, and its colours in
 * `SignalBrand.scss` are where its edges fall along it.
 */
export const WORDMARK_LOGO_LEAD = 170;

const { box, tailEnd } = WORDMARK_SHAPE;

/** The tail's ink: the word's last colour, fading out over its last fifth. */
export function TailInk({ id }: { id: string }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" style={{ stopColor: 'var(--wordmark-to)' }} />
      <stop offset="0.8" style={{ stopColor: 'var(--wordmark-to)' }} />
      <stop
        offset="1"
        style={{ stopColor: 'var(--wordmark-to)', stopOpacity: 0 }}
      />
    </linearGradient>
  );
}

/**
 * "FluidEQ" in the broad pen, filled with the header's one gradient: the
 * accent's greener end at the logo's left edge, the accent, and the window's
 * second colour at the Q (Ivan, 2026-11-26: "Ramp", and "one logo ... the
 * text color ... needs to match that updated logo fluidly"). The stops are
 * CSS properties, so a theme, a visualizer's colours or Colourful mode
 * repaint it with nothing rendered again.
 *
 * Named as the product for anybody reading the page; its height is the
 * stylesheet's, its width follows from the drawing.
 */
export default function WordmarkLetters({ className }: { className?: string }) {
  const ink = `wordmark-ink-${useId().replace(/:/g, '')}`;
  const style: CSSProperties = { aspectRatio: `${box.width} / ${box.height}` };
  return (
    <svg
      className={
        className ? `wordmark-letters ${className}` : 'wordmark-letters'
      }
      viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
      style={style}
      role="img"
      aria-label={PRODUCT_NAME}
    >
      <defs>
        <linearGradient
          id={ink}
          gradientUnits="userSpaceOnUse"
          x1={box.x - WORDMARK_LOGO_LEAD}
          y1={0}
          x2={tailEnd.x}
          y2={0}
        >
          <stop offset="0" style={{ stopColor: 'var(--wordmark-from)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--wordmark-mid)' }} />
          <stop offset="1" style={{ stopColor: 'var(--wordmark-to)' }} />
        </linearGradient>
      </defs>
      <path d={WORDMARK_SHAPE.path} fill={`url(#${ink})`} />
    </svg>
  );
}
