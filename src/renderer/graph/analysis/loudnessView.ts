/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ANALYSIS_RANGE_DB,
  STILL_ENOUGH,
  advanceHold,
  easeFactor,
  type IAnalysisFrame,
  type IAnalysisState,
} from './analysisFrame';
import {
  layoutPanel,
  paintBar,
  paintCorrelation,
  paintDial,
  paintTrace,
  paintWidth,
} from './loudnessPanel';
import {
  meterLevel,
  readStereoBlock,
  type IStereoReading,
} from './stereoReading';

/**
 * Stereo & loudness: what the mix is doing across the two channels.
 *
 * A meter bridge, not a chart. Four readings in one box, and the reason they
 * are one view rather than four is that nobody reads any of them alone — a
 * narrow image is only worth knowing about beside the level it happened at.
 *
 *  - The GONIOMETER, the dial on the left: every pair of samples plotted with
 *    the two channels as the two diagonals, so a centred mono signal stands
 *    straight up and anything panned leans to its own side. A tall thin line
 *    is mono, a round cloud is wide, and a cloud lying flat is out of phase
 *    and will disappear the moment somebody plays it on a phone.
 *  - The CORRELATION scale under it: where that cloud sits as one number,
 *    +1 locked together to −1 fighting, with the half that means trouble
 *    marked out and a bracket over where the needle has been lately — so a
 *    passage that flickers out of phase leaves a mark rather than a twitch
 *    nobody caught.
 *  - The two LEVEL BARS beside it, each with its letter, its peak hanging,
 *    the decibel scale ticked underneath and the number written out.
 *  - The WIDTH bar under them: how much of the sound is in the difference
 *    between the channels rather than in what they share.
 *
 * With one channel of capture — a mono source, or a stream negotiated that
 * way — the dial draws the straight vertical line a mono signal genuinely is.
 * That is the correct picture, not a stand-in for a missing one.
 *
 * The Channels row says nothing here: this view is two channels by
 * definition, so it measures both whichever way the row is set.
 */

/** How long a peak mark hangs, and how fast it falls afterwards. */
const PEAK_HANG_MS = 1400;
const PEAK_FALL = 0.22;

/** The correlation needle's half-life: slow, because it is read as a verdict. */
const CORRELATION_HALF_LIFE_MS = 260;

/** How long the bracket behind it remembers where the needle has been. */
const BRACKET_HALF_LIFE_MS = 2600;

/**
 * What the width bar is called: the arrow every meter bridge marks stereo
 * width with. A symbol rather than a word, so it needs no translating and
 * fits the same few pixels as the channel letters beside it.
 */
const WIDTH_LABEL = '↔';

const drawLoudnessView = (
  frame: IAnalysisFrame,
  state: IAnalysisState,
): boolean => {
  const { context, band, deltaMs, scope, levels, colours, channelLabels } =
    frame;
  const panel = layoutPanel(frame);
  if (!panel) {
    return false;
  }

  /**
   * With no per-channel samples the panel still has to say something true, so
   * the meters fall back to the spectrum's own loudness and the dial draws
   * the straight line that reading describes.
   */
  let reading: IStereoReading;
  if (scope) {
    reading = readStereoBlock(scope[0], scope[1]);
  } else {
    let loudest = 0;
    for (let index = 0; index < levels.length; index += 1) {
      if (levels[index] > loudest) {
        loudest = levels[index];
      }
    }
    const amplitude = 10 ** (((loudest - 1) * ANALYSIS_RANGE_DB) / 20);
    reading = {
      leftPeak: amplitude,
      rightPeak: amplitude,
      leftRms: amplitude,
      rightRms: amplitude,
      correlation: 1,
      width: 0,
      balance: 0,
    };
  }

  const toward = easeFactor(deltaMs, CORRELATION_HALF_LIFE_MS);
  state.correlation += (reading.correlation - state.correlation) * toward;
  state.loudness += (reading.width - state.loudness) * toward;
  /**
   * The bracket: the lowest and highest the needle has reached lately, each
   * pulled back toward it slowly.
   */
  const forget = easeFactor(deltaMs, BRACKET_HALF_LIFE_MS);
  state.meterPeaks[0] = Math.min(state.correlation, state.meterPeaks[0]);
  state.meterPeaks[1] = Math.max(state.correlation, state.meterPeaks[1]);
  state.meterPeaks[0] += (state.correlation - state.meterPeaks[0]) * forget;
  state.meterPeaks[1] += (state.correlation - state.meterPeaks[1]) * forget;

  state.meters[0] = meterLevel(reading.leftPeak);
  state.meters[1] = meterLevel(reading.rightPeak);
  const loudest = advanceHold(
    state.crest,
    state.meterPeakMs,
    state.meters,
    deltaMs,
    PEAK_HANG_MS,
    PEAK_FALL,
  );

  /**
   * A mirrored copy is the same panel reflected, exactly as every other view
   * on this graph is: the instruments are laid out once, downward, and the
   * flip is a transform around all of them.
   */
  context.save();
  if (band.flipped) {
    context.translate(0, band.top + band.bottom);
    context.scale(1, -1);
  }
  paintDial(frame, panel);
  paintTrace(frame, panel, scope, state.meters[0]);
  paintCorrelation(
    frame,
    panel,
    state.correlation,
    state.meterPeaks[0],
    state.meterPeaks[1],
  );
  paintBar(
    frame,
    panel,
    0,
    channelLabels[0],
    state.meters[0],
    state.crest[0],
    colours,
  );
  paintBar(
    frame,
    panel,
    1,
    channelLabels[1],
    state.meters[1],
    state.crest[1],
    frame.mate,
  );
  paintWidth(frame, panel, WIDTH_LABEL, state.loudness);
  context.restore();
  context.globalAlpha = 1;
  return loudest > STILL_ENOUGH || Math.abs(state.correlation) > 0.01;
};

export default drawLoudnessView;
