/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { CSSProperties } from 'react';
import { PRODUCT_VERSION } from 'common/branding';
import { WORDMARK_SHAPE } from './WordmarkLetters';
import { shortVersion } from './wordmarkRoom';

/** The version as the name carries it, two numbers. */
export const WORDMARK_VERSION = shortVersion(PRODUCT_VERSION);

const { box, tailEnd, qShoulder } = WORDMARK_SHAPE;

/** Where the tail leaves the Q, as fractions of the word's box. */
export const TAIL_X = (tailEnd.x - box.x) / box.width;
export const TAIL_Y = (tailEnd.y - box.y) / box.height;

/** The version over the Q's shoulder, wherever the word is drawn. */
export const VERSION_STYLE: CSSProperties = {
  left: `calc(${((qShoulder.x - box.x) / box.width) * 100}% + 3px)`,
  top: `calc(${((qShoulder.y - box.y) / box.height) * 100}% - 1px)`,
};

/** The tail's box: from the Q's tail, 24px tall around its line. */
export const tailBoxStyle = (length: number): CSSProperties => ({
  left: `${TAIL_X * 100}%`,
  top: `calc(${TAIL_Y * 100}% - 12px)`,
  width: length,
});

/** The word's height where the header draws it at full size, px. */
export const WORDMARK_HEIGHT_PX = 36;
