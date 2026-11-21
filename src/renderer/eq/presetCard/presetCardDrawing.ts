/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IEqSettings } from '../../../common/dsp/chain';
import { dspPresetVoicing } from '../../../common/dsp/presetVoicing';
import {
  getVoicingFilters,
  getVoicingGraphicEq,
} from '../../../common/voicing';
import {
  curveScales,
  makePath,
  type ICurveBox,
} from '../../graph/curvePreview';
import { layerLines, type TLayerLines } from '../../graph/layerLines';
import { getCombinedLineData } from '../../graph/utils';

/**
 * The strip a card draws its curve in, in the SVG's own units. Stretched
 * across the card's width (`preserveAspectRatio="none"`) and drawn at the
 * strip's own height (`$card-curve`, 20px), so only the frequency axis is
 * ever scaled. The top and bottom inset keep a 1.5px stroke at full reach
 * off the edge.
 */
export const CARD_CURVE_BOX = {
  width: 240,
  height: 20,
  padding: { top: 2, right: 1, bottom: 2, left: 1 },
} as const satisfies ICurveBox;

/**
 * The least the scale reaches either side of 0 dB, and the steps it widens
 * in for a curve past it rather than run off the strip.
 *
 * Measured over the 83 genre presets as the Preset layer plays them: the
 * furthest each curve reaches from 0 dB is 2.2 dB at the median and 3.2 dB
 * at most. On the ±6 dB the wider previews use (`PresetCurveSpark`) that
 * left every line in the middle third of a 20px strip, a wobble nobody
 * could read. ±4 dB still holds the whole catalogue on one scale, so cards
 * side by side compare honestly; a listener's own preset that moves further
 * widens its own card's scale.
 */
const FLOOR_DB = 4;
const STEP_DB = 2;
const LOW_HZ = 20;
const HIGH_HZ = 20_000;

/**
 * How many ways of drawing are remembered at once. The output's rate reads
 * as unknown for a moment each time the window is come back to
 * (`useOutputRate`), so two are in use all the time; a change of the EQ
 * mode menu adds another.
 */
const KEPT_DESIGNS = 4;

/** A card's curve, ready for its SVG. */
export interface IPresetCardCurve {
  line: string;
  /** The line closed along 0 dB: what the glow under it fills. */
  area: string;
  /** Where 0 dB lies in the box: the hairline the curve leaves from. */
  zero: number;
}

/**
 * How the Preset layer is drawn now — the EQ mode menu's Your EQ row, the
 * engine's treble design and the output's rate (`createLayerLines`) — and a
 * name for it: two designs with one name draw every curve the same.
 */
export interface IPresetCurveDesign {
  key: string;
  lines: TLayerLines;
}

/** Per design, each curve's drawing; `null` for a curve that draws nothing. */
const drawings = new Map<
  string,
  WeakMap<IEqSettings, IPresetCardCurve | null>
>();

/**
 * One curve as the main graph draws the Preset layer for it: the bands at
 * the Q their model builds them with (`dspPresetVoicing`), through the same
 * group strength, band shape, treble design and rate as the graph's own
 * preset line (`layerLines`), summed. Null where nothing would play — a
 * curve switched off, or one holding only dynamic bands, which no static
 * filter stands for.
 */
const drawCurve = (
  curve: IEqSettings,
  lines: TLayerLines,
): IPresetCardCurve | null => {
  const voicing = dspPresetVoicing('card', curve);
  const drawn = layerLines(lines, {
    feature: 'voicing',
    isBypassed: false,
    graphic: getVoicingGraphicEq(voicing),
    filters: getVoicingFilters(voicing),
    graphicId: 'card-graphic',
    filterPrefix: 'card',
  });
  if (Object.keys(drawn).length === 0) {
    return null;
  }
  const points = getCombinedLineData(0, drawn);
  const reach = points
    .filter((point) => point.x >= LOW_HZ && point.x <= HIGH_HZ)
    .reduce(
      (widest, point) =>
        Math.max(widest, Math.ceil(Math.abs(point.y) / STEP_DB) * STEP_DB),
      FLOOR_DB,
    );
  const bounds = { min: -reach, max: reach };
  const { path } = makePath(points, CARD_CURVE_BOX, bounds);
  if (!path) {
    return null;
  }
  const zero = curveScales(CARD_CURVE_BOX, bounds).y(0).toFixed(2);
  const { padding, width } = CARD_CURVE_BOX;
  const { left } = padding;
  const right = width - padding.right;
  return {
    line: path,
    area: `${path} L${right},${zero} L${left},${zero} Z`,
    zero: Number(zero),
  };
};

/**
 * A preset's curve for its card, worked out once per curve and design and
 * remembered: a card coming back into the grid after a search or a change of
 * group, or the whole grid after the window is come back to, finds its line
 * already drawn instead of running every band through the biquads again.
 * Keyed on the curve object itself, which the catalogue keeps for as long as
 * the preset is unchanged (`useDspPresetCatalog`); an edited preset is a new
 * object, and its old drawing goes with the old object.
 */
export const presetCardCurve = (
  curve: IEqSettings | undefined,
  design: IPresetCurveDesign,
): IPresetCardCurve | undefined => {
  if (!curve) {
    return undefined;
  }
  let byCurve = drawings.get(design.key);
  if (!byCurve) {
    if (drawings.size >= KEPT_DESIGNS) {
      const oldest = drawings.keys().next();
      if (!oldest.done) {
        drawings.delete(oldest.value);
      }
    }
    byCurve = new WeakMap();
    drawings.set(design.key, byCurve);
  }
  const known = byCurve.get(curve);
  if (known !== undefined) {
    return known ?? undefined;
  }
  const drawing = drawCurve(curve, design.lines);
  byCurve.set(curve, drawing);
  return drawing ?? undefined;
};
