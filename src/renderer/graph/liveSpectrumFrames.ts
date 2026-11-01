/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { MIN_GAIN } from 'common/constants';
import { Translate } from 'common/i18n';
import {
  MAX_FREQUENCY,
  WAVEFORM_POINT_COUNT,
  createFrequencyAxis,
  type IChartPointData,
} from 'common/liveFrames';
import { IOutputLevel, LEVEL_FLOOR_DB } from './outputLevel';
import captureLinuxOutput from './linuxOutputCapture';

/*
 * One frame of the live spectrum: what it is measured with, and how it is read.
 *
 * Three hundred and forty lines of useLiveOutputSpectrum.ts that never touched
 * React — the FFT size and the frequency axis, the clip detector, the buffers a
 * frame is written into, and the capture that asks Windows for the system
 * output. All of it is arithmetic over a Float32Array plus one browser call.
 *
 * Kept out of the hook because a hook is a lifetime and this is not: these run
 * thirty times a second inside it, and none of them care that they were called
 * from a component. The arithmetic a frame is made of is shared with the
 * core's desktop frames (`common/liveFrames.ts`) and handed on from here.
 */
export {
  DRAW_SMOOTHING,
  FFT_SIZE,
  LEVEL_FFT_SIZE,
  LIVE_FULL_SCALE_DB,
  LIVE_SILENCE_DB,
  MAX_FREQUENCY,
  METER_CHANNELS,
  MIN_FREQUENCY,
  NO_POINTS,
  POINT_COUNT,
  SPECTRUM_SMOOTHING,
  TRACK_REFERENCE_RELEASE_DB,
  UPDATE_INTERVAL_MS,
  WAVEFORM_POINT_COUNT,
  createFrameBuffers,
  createFrequencyAxis,
  getPeakLevel,
  writeChannelWaveformPoints,
  writeFrequencyPoints,
  type IFrameBuffers,
} from 'common/liveFrames';

/** Shared empty, so a stopped capture never mints a fresh array. */
export const NO_LEVELS: IOutputLevel[] = [];

/**
 * Digital full scale, as a linear amplitude. Reaching it is what clipping
 * looks like from here — too much EQ boost or preamp, with nowhere left for
 * the signal to go.
 *
 * `>=` AND NOT `>`, and the difference is the whole detector. Strictly greater
 * is the textbook definition and it is unreachable in this position: whatever
 * sits between the equaliser and this capture clamps, so a signal driven to
 * three times full scale does not arrive as 3.0, it arrives as 1.0 with its
 * peaks sheared flat. The overshoot is destroyed before we see it and only the
 * ceiling survives, so the ceiling is what has to be tested for.
 *
 * READ FROM THE FLOAT SAMPLES. `getByteTimeDomainData` has eight bits and
 * clamps at 255, so it cannot represent anything above full scale at all; the
 * closest rail it could offer was byte 254, which is amplitude 0.984 — −0.14
 * dBFS, and merely loud. `getFloatTimeDomainData` is not clamped by the
 * analyser, so a signal driven past the ceiling arrives as the number it is.
 *
 * WHAT THIS WILL AND WILL NOT CATCH, measured on this machine rather than
 * assumed. With auto-normalise off and the preamp at +20 dB, the loopback
 * reports a peak of 0.92 while the audio is audibly breaking up: something
 * upstream of the capture — the Windows mixer, or Chromium's own capture
 * pipeline — clamps before we see it, so the overshoot that would trip this is
 * destroyed a step before it reaches us. The threshold is nonetheless the
 * correct one: it says clipping and only clipping, and it will not light on
 * audio that is merely loud, which every softer value tried here did. Knowing
 * that the chain is asking for more than the output can carry is a question for
 * the chain's own gain, not for this capture.
 */
export const CLIP_RAIL_AMPLITUDE = 1;
/** How long a clip indication stays up after the last railed frame. */
// Long enough that a clipped frame of 45ms cannot pass unseen, short enough
// that the warning is about now. It was 1200, which with the fade after it
// left a red edge standing for the better part of two seconds — long after
// the passage that caused it.
export const CLIP_HOLD_MS = 420;

export const detectClipping = (timeDomainData: ArrayLike<number>): boolean => {
  for (let index = 0; index < timeDomainData.length; index += 1) {
    // No run length. Unlike a level threshold this needs no protection from
    // loud music: a sample above full scale is not a peak that happens to be
    // near the ceiling, it is a value that could not be represented.
    if (Math.abs(timeDomainData[index]) >= CLIP_RAIL_AMPLITUDE) {
      return true;
    }
  }
  return false;
};

/**
 * How many failed captures in a row are tried again.
 *
 * A capture that fails once has usually lost a race — the endpoint is
 * mid-switch, Windows has not finished handing the device over — and the next
 * attempt is made on the event that can make it succeed: a device arriving or
 * leaving, the output changing, the window being come back to. Never on a
 * timer, which guessed how long Windows takes and was wrong in both directions.
 *
 * Finite, because a capture that fails forever used to be tried forever.
 * Windows Graphics Capture denies the window on some setups — `CreateForWindow
 * failed with hr: -2147024891`, which is E_ACCESSDENIED — and each attempt
 * negotiated a fresh capture session, was refused, and logged two errors on
 * the way out. Nothing about the tenth attempt was more likely to succeed than
 * the second; it just made the log unreadable and kept Chromium busy. After
 * six, only somebody asking again starts another: a new owner, the window
 * shown again, the notice's button.
 */
export const MAX_START_RETRIES = 6;

/** Shared empty, so silence and teardown never mint a fresh array. */
export const NO_WAVEFORM: number[] = [];

/**
 * The waveform the capture publishes once when the output comes to rest, and
 * after which it publishes nothing until sound returns (`isMeterAtRest`).
 *
 * Its own array rather than one of the pair, so a drawing can tell the last
 * frame from one more of a stream. Anything that was letting go of a reading
 * a step per published frame — the titlebar's held peak — has to finish that
 * on its own clock from here, because no further frame is coming to count.
 */
export const SILENT_WAVEFORM: number[] = Array.from(
  { length: WAVEFORM_POINT_COUNT },
  () => 0,
);

/**
 * Whether a frame of the meters has nothing left to show: every sample of the
 * window a digital zero, and each channel's level and held peak down on the
 * floor with no clip warning standing.
 *
 * Exactly zero, not quiet. A waveform with anything in it still draws, and
 * the titlebar reads a peak down to -70 dBFS, ten decibels under the meter's
 * floor, so only digital silence is a frame every drawing agrees is at rest.
 */
export const isMeterAtRest = (
  waveform: readonly number[],
  levels: readonly IOutputLevel[],
): boolean =>
  waveform.every((sample) => sample === 0) &&
  levels.every(
    (level) =>
      !level.isClipping &&
      level.levelDb <= LEVEL_FLOOR_DB &&
      level.peakDb <= LEVEL_FLOOR_DB,
  );

/**
 * The shape of silence: the analyser's own axis, every band at the floor.
 *
 * A capture that has nothing to report publishes `NO_POINTS`, and a drawing
 * handed an empty array has no bands to draw and used to remove itself from the
 * page — which is what made the visualizer vanish the instant the music
 * stopped. This is what it draws instead. It is deliberately not an invented
 * frame: every band reads `MIN_GAIN`, so the figure rests flat rather than
 * moving to music that is not playing.
 *
 * Shared and frozen for the same reason as the empties above, and more so:
 * silence is the one state that can last for hours, and minting three hundred
 * and twenty objects per render through it would make an idle window the most
 * allocating thing in the app.
 */
export const SILENT_POINTS: readonly IChartPointData[] = Object.freeze(
  createFrequencyAxis(MAX_FREQUENCY * 2).map((frequency) =>
    Object.freeze({ x: frequency, y: MIN_GAIN }),
  ),
);

// Handed a translator rather than reaching for one: this is a plain async
// function outside the component, so it cannot call a hook.
export const captureSystemOutput = async (
  t: Translate,
): Promise<MediaStream> => {
  if (!navigator.mediaDevices) {
    throw new Error(t('eq.smart.error.noCapture'));
  }
  if (window.electron?.platform === 'linux') {
    return captureLinuxOutput(t);
  }

  let displayCaptureError: unknown;
  // Prefer getDisplayMedia. Electron's main-process handler supplies a
  // harmless window video source plus the Windows loopback audio stream. This
  // avoids the legacy desktop constraints trying to open a physical monitor.
  if (navigator.mediaDevices.getDisplayMedia) {
    try {
      // Chromium's voice processing off, explicitly, and it matters twice over.
      //
      // As a *measurement*: this capture is what draws the live curve and what
      // Smart EQ corrects from, and all three of these change the signal.
      // Automatic gain rides the level, so the curve would describe Chromium's
      // idea of loudness rather than the track's; noise suppression carves at
      // quiet detail; the reading has to be of the output, not of a processed
      // version of it.
      //
      // As a *mirror*: echo cancellation is the one that bites. It exists to
      // subtract what the machine is playing from what it is hearing — and a
      // mirror plays the very audio this is capturing, so the canceller treats
      // its own output as an echo to remove and chases it. That is heard as
      // level pumping and a hollow, phasey cancelling that arrives exactly
      // when a second output is switched on.
      return await navigator.mediaDevices.getDisplayMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
        video: true,
      });
    } catch (constrainedError) {
      displayCaptureError = constrainedError;
    }

    try {
      // Some builds reject an audio constraint object on a display capture
      // outright. A processed capture is worse than an unprocessed one but far
      // better than none: losing the analyser, Smart EQ and the mirror over a
      // constraint is not a trade worth making.
      return await navigator.mediaDevices.getDisplayMedia({
        audio: true,
        video: true,
      });
    } catch (captureError) {
      displayCaptureError = captureError;
    }
  }

  if (!navigator.mediaDevices.getUserMedia) {
    throw displayCaptureError || new Error(t('eq.smart.error.noLoopback'));
  }

  try {
    // Legacy fallback for older Electron builds. Newer builds use the
    // display-media handler above, but keeping this path makes the analyser
    // usable in a preview/portable environment too.
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
        },
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
        },
      },
    } as MediaStreamConstraints);
  } catch (legacyCaptureError) {
    throw legacyCaptureError || displayCaptureError;
  }
};
