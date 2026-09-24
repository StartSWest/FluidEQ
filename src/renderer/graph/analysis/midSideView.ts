/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  STILL_ENOUGH,
  type IAnalysisFrame,
  type IAnalysisState,
} from './analysisFrame';
import { asMate, paintChannelLegend } from './channelInk';
import { paintSpectrum, spectrumInk, spectrumLine } from './spectrumPaint';

/**
 * Mid & side: what the two channels SHARE, against what only one of them has.
 *
 * Left and right tells you which speaker a sound came out of. Mid and side
 * tells you something a mix engineer can act on: the mid is everything
 * sitting in the middle — the kick, the bass, the lead vocal — and the side
 * is everything that makes the picture wide. Put one over the other and the
 * shape of the record's stereo image appears as a gap between two curves.
 *
 * What it is read for: side energy down in the bass (which is where it
 * belongs — wide bass collapses on a phone and rattles a club rig), side
 * energy rising through the top (air, reverb, doubled guitars), and side
 * energy that suddenly matches the mid, which means something is out of
 * phase rather than wide.
 *
 * The two are measured, not derived: a magnitude spectrum has thrown its
 * phase away, so the mid cannot be recovered from the left and right
 * spectra afterwards. They are summed and subtracted in the SOUND, before
 * either is transformed (`useAnalysisChannels`).
 *
 * The Channels row says nothing here. This view is already a split, into a
 * different pair.
 */

/** What the two figures are called, as the legend says them. */
const MID_LABEL = 'M';
const SIDE_LABEL = 'S';

const drawMidSideView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { context, tuning, levels, split, band } = frame;
  if (!split) {
    /**
     * Nothing measured yet: the shared reading is the mid of a centred
     * record within a hair, so it is drawn alone rather than leaving the
     * plot empty. It becomes the real pair the moment the analysers arrive.
     */
    context.globalAlpha = band.opacity;
    paintSpectrum(frame, levels, {
      fillAlpha: tuning.fillOpacity,
      edgeAlpha: 1,
    });
    context.globalAlpha = 1;
    return state.seeded;
  }

  const [mid, side] = split;
  // The side behind and in its own colours, the mid in front: the mid is
  // the record and the side is what has been done to it.
  const behind = asMate(frame);
  context.globalAlpha = band.opacity * 0.85;
  paintSpectrum(behind, side, {
    fillAlpha: tuning.fillOpacity * 0.6,
    edgeAlpha: 0.8,
    edgeWidth: Math.max(1, frame.edge.width - 0.4),
    textured: false,
  });
  context.globalAlpha = band.opacity;
  paintSpectrum(frame, mid, { fillAlpha: tuning.fillOpacity, edgeAlpha: 0 });
  context.lineWidth = frame.edge.width;
  context.lineJoin = 'round';
  context.strokeStyle = spectrumInk(frame, mid);
  context.stroke(spectrumLine(frame, mid));
  context.globalAlpha = 1;
  paintChannelLegend(frame, [MID_LABEL, SIDE_LABEL]);
  let loudest = 0;
  for (let index = 0; index < mid.length; index += 1) {
    if (mid[index] > loudest) {
      loudest = mid[index];
    }
    if (side[index] > loudest) {
      loudest = side[index];
    }
  }
  return loudest > STILL_ENOUGH;
};

export default drawMidSideView;
