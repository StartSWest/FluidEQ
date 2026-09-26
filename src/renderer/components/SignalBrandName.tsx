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
 * letter after another as the logo's wave draws itself. The first part is
 * white; "EQ" is one box of its own, drawn in Lagoon, the icon's colours
 * (`SignalBrand.scss`). Read as one word: the letters are one text node each,
 * with nothing between them.
 */
export default function SignalBrandName() {
  const letters = [...PRODUCT_NAME];
  const glowFrom = PRODUCT_NAME.endsWith(GLOWING_SUFFIX)
    ? letters.length - GLOWING_SUFFIX.length
    : letters.length;
  const letter = (char: string, index: number) => (
    <span
      // A letter's place is its identity: the name never reorders.
      // eslint-disable-next-line react/no-array-index-key -- see above
      key={index}
      className={`signal-name__letter${
        index >= glowFrom ? ' signal-name__letter--glow' : ''
      }`}
      style={{ '--letter-index': index } as CSSProperties}
    >
      {char}
    </span>
  );
  return (
    <span className="signal-name">
      {letters.slice(0, glowFrom).map((char, index) => letter(char, index))}
      {glowFrom < letters.length && (
        <span
          className="signal-name__suffix"
          style={{ '--letter-index': glowFrom } as CSSProperties}
        >
          {letters
            .slice(glowFrom)
            .map((char, index) => letter(char, glowFrom + index))}
        </span>
      )}
    </span>
  );
}
