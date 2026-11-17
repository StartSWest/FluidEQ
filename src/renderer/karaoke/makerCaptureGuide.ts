/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { karaokeMakerRecordedLineRange } from '../../common/karaoke/makerProject';
import formatClock from './makerFormat';
import { type IGuidedLineCapture } from './useMakerLineCapture';
import { type IKaraokeMakerLine } from '../../common/karaoke/makerProject/model';
import { type Translate } from '../../common/i18n';

interface IMakerCaptureGuideInput {
  lineEntryCapture: IGuidedLineCapture | undefined;
  /**
   * Whether the playhead is within the last 650 ms before the line's
   * estimated end (`isLineCaptureReadyAt`): the one thing asked of it, so the
   * tools render when that turns and not on every tick.
   */
  isNearEstimatedEnd: boolean;
  lineEntryMode: boolean;
  lyricLines: IKaraokeMakerLine[];
  lineEntryIndex: number;
  t: Translate;
}

/** The end of a line being captured is ready this close to its estimate. */
export const isLineCaptureReadyAt = (
  lineEntryCapture: IGuidedLineCapture | undefined,
  playheadMs: number,
) =>
  lineEntryCapture !== undefined &&
  playheadMs >= lineEntryCapture.estimatedEndMs - 650;

/**
 * Where line recording stands on the line being captured: whether its
 * end is armed or ready, the line and the one after it, which press comes
 * next, how far the line has got, and the sentence that says what to do.
 * Pure derivation from the capture and the playhead.
 */
const makerCaptureGuide = ({
  lineEntryCapture,
  isNearEstimatedEnd,
  lineEntryMode,
  lyricLines,
  lineEntryIndex,
  t,
}: IMakerCaptureGuideInput) => {
  let lineCaptureState: 'armed' | 'ready' | undefined;
  if (lineEntryCapture) {
    lineCaptureState = isNearEstimatedEnd ? 'ready' : 'armed';
  }
  const captureGuideLine = lineEntryMode
    ? lyricLines[lineEntryIndex]
    : undefined;
  const captureGuideNextLine = lineEntryMode
    ? lyricLines[lineEntryIndex + 1]
    : undefined;
  const captureGuideIsArmed =
    captureGuideLine !== undefined &&
    lineEntryCapture?.lineId === captureGuideLine.id;
  const captureGuideHasRecordedEnd =
    captureGuideLine !== undefined &&
    !captureGuideIsArmed &&
    karaokeMakerRecordedLineRange(captureGuideLine) !== undefined;
  const captureGuidePhase: 'start' | 'end' = captureGuideIsArmed
    ? 'end'
    : 'start';
  let captureGuideVisualState: 'pending' | 'started' | 'complete' = 'pending';
  if (captureGuideHasRecordedEnd) {
    captureGuideVisualState = 'complete';
  } else if (captureGuideIsArmed) {
    captureGuideVisualState = 'started';
  }
  let captureGuideInstruction = t('karaoke.maker.capturePressStart');
  if (captureGuideIsArmed && lineEntryCapture) {
    captureGuideInstruction = t(
      lineEntryCapture.automaticStart
        ? 'karaoke.maker.captureAutomaticStart'
        : 'karaoke.maker.captureStartSaved',
      { time: formatClock(lineEntryCapture.startMs) },
    );
  } else if (captureGuideHasRecordedEnd) {
    captureGuideInstruction = t('karaoke.maker.captureReplaceStart');
  }

  return {
    lineCaptureState,
    captureGuideLine,
    captureGuideNextLine,
    captureGuidePhase,
    captureGuideVisualState,
    captureGuideInstruction,
  };
};

export default makerCaptureGuide;
