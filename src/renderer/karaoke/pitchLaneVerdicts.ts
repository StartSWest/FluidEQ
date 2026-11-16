/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type TKaraokeVerdict } from '../../common/karaoke/scoring';
import { LYRIC_FONT_FAMILY } from './karaokeLyricText';
import { drawRoundedRect } from './makerCanvasGeometry';
import { type IKaraokeLaneVerdict } from './useKaraokeScore';

// The verdict over every note as it ends, the strip of the E mockup (Ivan,
// 2026-11-16, "E · Veredicto por nota"; sent back the same day as "not at
// all like the mockups", so every number here is the mockup's own): the
// note takes its verdict's colour and a small chip pops above it with the
// word. Flat, as the strip is: a tinted chip with a hairline, no shadow and
// no glow.

// The mockup's three tuning colours, which the singer's line wears too
// (`pitchLaneTrace.ts`) and the rows under the strip are written in
// (`$score-on`, `$score-near`, `$score-off` in `_karaokeScoreTokens.scss`).
// Not the accent: green for in tune is what makes a note sung right stand
// apart from a note still to sing, which is accent-coloured.
const ON: readonly [number, number, number] = [141, 245, 184];
const NEAR: readonly [number, number, number] = [242, 208, 79];
const OFF: readonly [number, number, number] = [255, 106, 94];
/** The mockup's faint text colour, `rgba(236, 245, 251, 0.44)`. */
const MISSED: readonly [number, number, number] = [236, 245, 251];
const MISSED_STRENGTH = 0.44;
/** A note sung well but not perfectly: the mockup's 0.6 against 0.85. */
const GOOD_STRENGTH = 0.7;

const rgba = (
  [red, green, blue]: readonly [number, number, number],
  alpha: number,
) => `rgba(${red}, ${green}, ${blue}, ${alpha})`;

/** A verdict's colour at an alpha: green, green dimmer, yellow, red. */
export const verdictColour = (
  verdict: TKaraokeVerdict,
  alpha: number,
): string => {
  switch (verdict) {
    case 'perfect':
      return rgba(ON, alpha);
    case 'good':
      return rgba(ON, alpha * GOOD_STRENGTH);
    case 'late':
      return rgba(NEAR, alpha);
    case 'low':
    case 'high':
      return rgba(OFF, alpha);
    default:
      return rgba(MISSED, alpha * MISSED_STRENGTH);
  }
};

/** Within this many cents of the note the line is green. */
const LINE_ON_CENTS = 30;
/** Within this many it is yellow; further out, red. */
const LINE_NEAR_CENTS = 60;
/** The mockup's second text colour: the line where no note is near. */
const LINE_FREE = 'rgba(236, 245, 251, 0.68)';

/**
 * The singer's line at one sample, by how far it is from its note: the
 * mockup's classes, so the line and the verdict it earns speak the same
 * colours. `undefined` is a sample with no note near it.
 */
export const pitchLineColour = (cents: number | undefined): string => {
  if (cents === undefined || !Number.isFinite(cents)) {
    return LINE_FREE;
  }
  const off = Math.abs(cents);
  if (off <= LINE_ON_CENTS) {
    return rgba(ON, 1);
  }
  return off <= LINE_NEAR_CENTS ? rgba(NEAR, 1) : rgba(OFF, 1);
};

export interface IJudgedNoteBox {
  left: number;
  right: number;
  top: number;
  judged: IKaraokeLaneVerdict;
}

interface IPaintVerdictChipsInput {
  context: CanvasRenderingContext2D;
  boxes: readonly IJudgedNoteBox[];
  labelOf: (judged: IKaraokeLaneVerdict) => string;
  now: number;
  reducedMotion: boolean;
}

const CHIP_HEIGHT = 14;
const CHIP_PAD_X = 5;
const CHIP_GAP = 4;
const CHIP_CORNER = 3;
/** How far past its note a chip may reach before it becomes a dot. */
const CHIP_OVERHANG = 14;
const DOT_RADIUS = 3;
/** The dot's centre over the note's top, as the mockup sets it. */
const DOT_LIFT = 7;
const POP_MS = 200;
const FADE_MS = 120;

/** The chips (or, over a note too short for one, dots), after every note. */
export const paintVerdictChips = ({
  context,
  boxes,
  labelOf,
  now,
  reducedMotion,
}: IPaintVerdictChipsInput) => {
  context.save();
  context.font = `700 9.5px ${LYRIC_FONT_FAMILY}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  boxes.forEach(({ left, right, top, judged }) => {
    const ageMs = now - judged.judgedAt;
    const popped = reducedMotion ? 1 : Math.min(1, Math.max(0, ageMs / POP_MS));
    const eased = 1 - (1 - popped) ** 3;
    context.globalAlpha = reducedMotion
      ? 1
      : Math.min(1, Math.max(0, ageMs / FADE_MS));
    const label = labelOf(judged);
    const chipWidth = context.measureText(label).width + CHIP_PAD_X * 2;
    const centreX = (left + right) / 2;
    // A good note is the perfect one's colour at a lower strength on the
    // strip; its word is what tells them apart, so it reads at full ink.
    const ink = judged.verdict === 'good' ? 'perfect' : judged.verdict;
    const tone = verdictColour(ink, 1);
    if (chipWidth > right - left + CHIP_OVERHANG) {
      context.fillStyle = tone;
      context.beginPath();
      context.arc(
        centreX,
        Math.max(DOT_RADIUS + 1, top - DOT_LIFT),
        DOT_RADIUS,
        0,
        Math.PI * 2,
      );
      context.fill();
      return;
    }
    // Held inside the strip: a note on its top row would otherwise lift its
    // chip off the canvas, where nobody can read it.
    const centreY = Math.max(
      CHIP_HEIGHT / 2 + 1,
      top - CHIP_GAP - CHIP_HEIGHT / 2 - (1 - eased) * 4,
    );
    const scale = 0.75 + 0.25 * eased;
    context.save();
    context.translate(centreX, centreY);
    context.scale(scale, scale);
    context.fillStyle = verdictColour(ink, 0.16);
    drawRoundedRect(
      context,
      -chipWidth / 2,
      -CHIP_HEIGHT / 2,
      chipWidth,
      CHIP_HEIGHT,
      CHIP_CORNER,
    );
    context.fill();
    context.lineWidth = 1;
    context.strokeStyle = verdictColour(ink, 0.6);
    drawRoundedRect(
      context,
      -chipWidth / 2 + 0.5,
      -CHIP_HEIGHT / 2 + 0.5,
      chipWidth - 1,
      CHIP_HEIGHT - 1,
      CHIP_CORNER,
    );
    context.stroke();
    context.fillStyle = tone;
    context.fillText(label, 0, 0.5);
    context.restore();
  });
  context.restore();
};
