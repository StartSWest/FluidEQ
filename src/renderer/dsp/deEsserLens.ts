/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDeEsserSettings } from '../../common/dsp/deEsser';
import { GRAPH_FONT, IDeEsserInks, IPlotBox } from './deEsserPlot';
import { drawSensitivity, drawShape } from './deEsserLensFrequency';
import {
  ILensLabels,
  label,
  POINT_FONT,
  POINT_INK,
  TDeEsserTune,
} from './deEsserLensKit';
import { drawCymbals, drawWhere } from './deEsserLensStage';
import drawTiming from './deEsserLensTime';

export type { ILensLabels, TDeEsserTune } from './deEsserLensKit';

/**
 * What the control being turned does, drawn where the history strip is while
 * the control is held, hovered or focused.
 *
 * Asked for from the listening chair (2026-10-14): most of the De-esser's
 * dials changed nothing on its display, so turning one was a guess. Each
 * picture is drawn from the rule the engine applies — the threshold from
 * Sensitivity, the cut shape from the band layout and its spread, the one-
 * pole timing, the cymbal margin, the centre tell — never from a sketch of
 * what a de-esser does, so what it shows is what the dial does. From and To
 * are shown where they already are, lit in the treble picture.
 */

/** Whether two reports name the same control, and the same option of a choice. */
export const sameTune = (one: TDeEsserTune, other: TDeEsserTune): boolean => {
  if (one.control !== other.control) {
    return false;
  }
  if (one.control === 'mode' && other.control === 'mode') {
    return one.mode === other.mode;
  }
  if (one.control === 'where' && other.control === 'where') {
    return one.centreOnly === other.centreOnly;
  }
  return true;
};

/** Whether the tune takes the history's place. */
export const lensShows = (tune: TDeEsserTune | undefined): boolean =>
  tune !== undefined && tune.control !== 'listening';

/** Everything a lens needs from the graph, one frame's worth. */
export interface ILensFrame {
  box: IPlotBox;
  settings: IDeEsserSettings;
  tune: TDeEsserTune;
  /** The loudest band against the voice's body now, dB; NaN with none. */
  sibilanceDb: number;
  inks: IDeEsserInks;
  labels: ILensLabels;
}

export const drawLens = (
  context: CanvasRenderingContext2D,
  frame: ILensFrame,
) => {
  const { box, settings, tune, inks, labels } = frame;
  const picture = { context, box, settings, inks, labels };
  context.save();
  context.beginPath();
  context.rect(box.x, box.y, box.width, box.height);
  context.clip();
  context.font = GRAPH_FONT;
  context.textBaseline = 'middle';
  context.lineWidth = 1;
  switch (tune.control) {
    case 'sensitivity':
      drawSensitivity(picture, frame.sibilanceDb);
      break;
    case 'depth':
    case 'width':
      drawShape(picture, settings.mode, tune.control, false);
      break;
    case 'mode':
      drawShape(picture, tune.mode, 'depth', true);
      context.font = POINT_FONT;
      label(
        context,
        labels.modes[tune.mode],
        box.x,
        box.y + 8,
        'left',
        POINT_INK,
      );
      break;
    case 'attack':
    case 'release':
      drawTiming(picture, tune.control);
      break;
    case 'keepCymbals':
      drawCymbals(picture);
      break;
    case 'where':
      drawWhere(picture, tune.centreOnly);
      break;
    default:
      break;
  }
  context.restore();
};
