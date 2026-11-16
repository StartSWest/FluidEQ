/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { type TKaraokeVerdict } from '../../common/karaoke/scoring';
import { readAccent } from '../utils/theme';
import { drawRoundedRect } from './makerCanvasGeometry';
import { type IKaraokeLaneVerdict } from './useKaraokeScore';

// The verdict over every note as it ends, the strip of the E mockup (Ivan,
// 2026-11-16, "E · Veredicto por nota"): the note takes its verdict's
// colour and a small chip pops above it with the word. Flat, as the strip
// is: a tinted chip with a hairline, no shadow and no glow.

/** `$amber`, the app's one caution colour (`_color.scss`). */
const AMBER: readonly [number, number, number] = [255, 176, 89];
/**
 * `$score-off` (`_karaokeScore.scss`): the app's `$red` taken down toward
 * the floor, so an off note reads as off without shouting over the stage.
 */
const MUTED_RED: readonly [number, number, number] = [224, 113, 124];
const MISSED: readonly [number, number, number] = [214, 233, 247];

const rgba = (
  [red, green, blue]: readonly [number, number, number],
  alpha: number,
) => `rgba(${red}, ${green}, ${blue}, ${alpha})`;

/** A verdict's colour at an alpha: the accent for good, amber, muted red. */
export const verdictColour = (
  verdict: TKaraokeVerdict,
  alpha: number,
): string => {
  switch (verdict) {
    case 'perfect':
      return readAccent(alpha, `rgba(50, 225, 234, ${alpha})`);
    case 'good':
      return readAccent(alpha * 0.62, `rgba(50, 225, 234, ${alpha * 0.62})`);
    case 'late':
      return rgba(AMBER, alpha);
    case 'low':
    case 'high':
      return rgba(MUTED_RED, alpha);
    default:
      return rgba(MISSED, alpha * 0.45);
  }
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
/** How far past its note a chip may reach before it becomes a dot. */
const CHIP_OVERHANG = 14;
const DOT_RADIUS = 3;
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
  context.font = '700 9.5px system-ui, sans-serif';
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
        Math.max(DOT_RADIUS + 1, top - CHIP_GAP - DOT_RADIUS),
        DOT_RADIUS * (0.6 + 0.4 * eased),
        0,
        Math.PI * 2,
      );
      context.fill();
      return;
    }
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
      3,
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
      3,
    );
    context.stroke();
    context.fillStyle = tone;
    context.fillText(label, 0, 0.5);
    context.restore();
  });
  context.restore();
};
