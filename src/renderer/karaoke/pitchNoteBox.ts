/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { midiToNoteName } from '../../common/karaoke/pitch';
import { readAccent, readAccentLight, readSurface } from '../utils/theme';
import { isLightWindow } from '../utils/windowSide';
import { inkForSide, onWhite, TEXT_ON_WHITE } from './karaokeCanvasInk';
import { LYRIC_FONT_FAMILY } from './karaokeLyricText';
import { drawRoundedRect } from './makerCanvasGeometry';

// One note box, drawn the same on the player's pitch strip and in the
// Maker's grid (Ivan, 2026-11-16: "tiene que puntearse de la misma forma que
// el player"), every size and colour the E mockup's ("Veredicto por nota").
// Each surface decides where the box goes and what fills it - the singer's
// voice on the strip (`pitchNoteFill.ts`), the selection in the Maker - and
// hands the rest to this.

export const NOTE_CORNER = 2;
/** How far the ring of a sung or selected note stands off its edge. */
export const NOTE_RING_GAP = 2.5;
/** An unsung note's accent, and every verdict's, at this strength. */
export const NOTE_STRENGTH = 0.85;
const ACCENT_FALLBACK = 'rgba(27, 222, 231, .85)';
/** The sung part of the note under the playhead, the mockup's own pale. */
const NOTE_SUNG = '#e8fffd';
const GOLDEN_SUNG = '#fff0a8';
const GOLDEN_RING = 'rgba(255, 240, 168, .95)';
const NAME_LIT = 'rgba(245, 255, 254, .98)';
const NAME_IDLE = '#cfe7ee';
const GOLDEN = '#ffd25a';

/**
 * The part of a note the playhead has crossed. On a dark window the pale
 * light above; on a white one a pale fill is the note being erased, so the
 * crossed part is inked in instead: the accent's deepest step, the golden
 * note's gold at text depth.
 */
const sungFill = (kind: TNoteBoxKind) => {
  if (!isLightWindow()) {
    return kind === 'golden' ? GOLDEN_SUNG : NOTE_SUNG;
  }
  return kind === 'golden'
    ? onWhite(GOLDEN, TEXT_ON_WHITE)
    : readSurface('--accent-darker', '#00464a');
};

/**
 * A note's name: on a white window the window's own text inks, the
 * secondary one, and the strongest over the note being sung. The pale cyans
 * were 1.2:1 there.
 */
const nameInk = (ringed: boolean) => {
  if (!isLightWindow()) {
    return ringed ? NAME_LIT : NAME_IDLE;
  }
  return ringed
    ? readSurface('--text-primary', '#1b1b1b')
    : readSurface('--text-muted', '#484848');
};
/** The rest drawn between one syllable's box and the next. */
const NOTE_GAP_MS = 40;

export type TNoteBoxKind = 'normal' | 'golden' | 'free';

/**
 * A note's box spans its whole syllable less a short rest, as the mockup
 * draws it. Both surfaces used to take the guide melody's articulation
 * (`karaokeLeadNoteShape`), which ends each note at 74-88% of its syllable at
 * random: the singer's line, sung through the syllable, ran off the end of
 * every box, and the Maker showed notes shorter than the timing it edits.
 * Half a syllable at most goes to the rest, so a very short one keeps a box.
 */
export const drawnNoteRange = (startMs: number, endMs: number) => ({
  startMs,
  endMs: endMs - Math.min(NOTE_GAP_MS, Math.max(0, endMs - startMs) / 2),
});

/** A box's height for a row this tall. */
export const noteBoxHeight = (semitoneHeight: number) =>
  Math.max(8, semitoneHeight * 0.8);

/** The colour of a note nobody has sung or picked yet. */
export const unsungNoteFill = (kind: TNoteBoxKind): string => {
  if (kind === 'golden') {
    return inkForSide(GOLDEN);
  }
  return kind === 'free'
    ? readAccent(0.24, 'rgba(27, 222, 231, .24)')
    : readAccent(NOTE_STRENGTH, ACCENT_FALLBACK);
};

/** The dashed edge of a free note, which is sung to no pitch. */
export const freeNoteEdge = () => readAccent(NOTE_STRENGTH, ACCENT_FALLBACK);

/** The ring round a sung or selected note. */
const ringColour = (kind: TNoteBoxKind) =>
  kind === 'golden'
    ? inkForSide(GOLDEN_RING)
    : readAccentLight(0.95, 'rgba(161, 252, 255, .95)');

interface IPaintNoteBoxInput {
  left: number;
  right: number;
  top: number;
  height: number;
  kind: TNoteBoxKind;
  /** A colour, or the strip's split between the part sung and the rest. */
  fill: string | CanvasGradient;
  /** The free note's dashed edge; only a free note has one. */
  freeEdge?: string;
  /** How much of the note the playhead has crossed, while it is under it. */
  progress?: number;
  /** A ring standing off the box: the note being sung, or a selected one. */
  ringed: boolean;
}

/**
 * The box: flat, a 2px corner, and a ring standing off it. Given `progress`,
 * the part the playhead has crossed fills with a pale light from its left -
 * the Maker, and the strip with nobody singing; a singer's strip paints the
 * voice over the box instead. Nothing else marks the note being sung - no
 * line at the playhead inside it.
 */
export const paintNoteBox = (
  context: CanvasRenderingContext2D,
  {
    left,
    right,
    top,
    height,
    kind,
    fill,
    freeEdge,
    progress,
    ringed,
  }: IPaintNoteBoxInput,
) => {
  const width = right - left;
  context.save();
  context.fillStyle = fill;
  drawRoundedRect(context, left, top, width, height, NOTE_CORNER);
  context.fill();
  if (kind === 'free' && freeEdge) {
    context.setLineDash([4, 3]);
    context.lineWidth = 1.6;
    context.strokeStyle = freeEdge;
    context.stroke();
    context.setLineDash([]);
  }
  if (progress !== undefined) {
    context.save();
    drawRoundedRect(context, left, top, width, height, NOTE_CORNER);
    context.clip();
    context.fillStyle = sungFill(kind);
    context.fillRect(left, top, Math.max(1, width * progress), height);
    context.restore();
  }
  if (ringed) {
    context.lineWidth = 1.5;
    context.strokeStyle = ringColour(kind);
    drawRoundedRect(
      context,
      left - NOTE_RING_GAP,
      top - NOTE_RING_GAP,
      width + NOTE_RING_GAP * 2,
      height + NOTE_RING_GAP * 2,
      NOTE_CORNER + NOTE_RING_GAP,
    );
    context.stroke();
  }
  context.restore();
};

interface IPaintNoteNameInput {
  midi: number;
  left: number;
  right: number;
  top: number;
  /** Over a ringed note: bright, and lifted clear of the ring. */
  ringed: boolean;
  /** The note under the playhead is named in bold. */
  bold: boolean;
}

/** Where one name was painted, in the canvas's own pixels. */
export interface INoteNamePlace {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** A name's cap height at 9px, and the air kept round it. */
const NAME_HEIGHT_PX = 9;
const NAME_AIR_PX = 1;

/**
 * The note's name over its box.
 *
 * Given `placed` - the names already painted this frame - a name that would
 * land on one of them is left out, so a run of short notes reads as names and
 * not as a pile of letters ("C6C5", "EDDS", Ivan's Maker on 2026-11-18). The
 * name over a ringed note, the one being sung or picked, is always painted.
 */
export const paintNoteName = (
  context: CanvasRenderingContext2D,
  { midi, left, right, top, ringed, bold }: IPaintNoteNameInput,
  placed?: INoteNamePlace[],
) => {
  context.fillStyle = nameInk(ringed);
  context.font = `${bold ? 700 : 600} 9px ${LYRIC_FONT_FAMILY}`;
  context.textAlign = 'center';
  context.textBaseline = 'alphabetic';
  const name = midiToNoteName(midi);
  const x = left + (right - left) / 2;
  const y = top - 4 - (ringed ? NOTE_RING_GAP + 1 : 0);
  if (placed) {
    const halfWidth = context.measureText(name).width / 2 + NAME_AIR_PX;
    const place = {
      left: x - halfWidth,
      right: x + halfWidth,
      top: y - NAME_HEIGHT_PX - NAME_AIR_PX,
      bottom: y + NAME_AIR_PX,
    };
    const crowded = placed.some(
      (other) =>
        place.left < other.right &&
        place.right > other.left &&
        place.top < other.bottom &&
        place.bottom > other.top,
    );
    if (crowded && !ringed) {
      return;
    }
    placed.push(place);
  }
  context.fillText(name, x, y);
};
