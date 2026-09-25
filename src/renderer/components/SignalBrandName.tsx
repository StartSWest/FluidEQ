/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { CSSProperties } from 'react';
import { PRODUCT_NAME } from 'common/branding';
import '../styles/SignalBrand.scss';

/**
 * Where the name's second part starts: "EQ", which glows each time the logo's
 * pulse reaches the end of its wave (`SignalBrandMark`).
 */
const GLOWING_SUFFIX = 'EQ';

/**
 * The product's name in the header, letter by letter: at launch it rises one
 * letter after another as the logo's wave draws itself, and in Rainbow mode
 * the whole name is one spectrum drifting through it, as the logo's tile is
 * (`SignalBrand.scss`). Read as one word: the letters are one text node each,
 * with nothing between them.
 */
export default function SignalBrandName() {
  const glowFrom = PRODUCT_NAME.endsWith(GLOWING_SUFFIX)
    ? PRODUCT_NAME.length - GLOWING_SUFFIX.length
    : PRODUCT_NAME.length;
  return (
    <span className="signal-name">
      {[...PRODUCT_NAME].map((letter, index) => (
        <span
          // A letter's place is its identity: the name never reorders.
          // eslint-disable-next-line react/no-array-index-key -- see above
          key={index}
          className={`signal-name__letter${
            index >= glowFrom ? ' signal-name__letter--glow' : ''
          }`}
          style={{ '--letter-index': index } as CSSProperties}
        >
          {letter}
        </span>
      ))}
    </span>
  );
}
