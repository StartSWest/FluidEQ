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

import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { Translate } from 'common/i18n';
import { IChartPointData } from './ChartController';
import { IOutputLevel } from './outputLevel';

/**
 * One frame of the live spectrum: what it is measured with, and how it is read.
 *
 * Three hundred and forty lines of useLiveOutputSpectrum.ts that never touched
 * React — the FFT size and the frequency axis, the clip detector, the buffers a
 * frame is written into, and the capture that asks Windows for the system
 * output. All of it is arithmetic over a Float32Array plus one browser call.
 *
 * Kept out of the hook because a hook is a lifetime and this is not: these run
 * thirty times a second inside it, and none of them care that they were called
 * from a component.
 */
/**
 * The analyser window, and the one source of lag nothing downstream can undo.
 *
 * An FFT describes a whole window of audio at once, so the result is only ever
 * as current as the middle of it: 4096 samples is 85ms of sound at 48kHz, and
 * a kick inside it is reported some 43ms after it actually hit. Easing,
 * interpolation and frame rate all sit after that and can only ever make the
 * delay smoother, never shorter.
 *
 * Halved, so the delay halves with it. The cost is resolution — 23Hz per bin
 * rather than 12 — which the log-spaced display bins down anyway everywhere
 * except the very bottom of the range, and which is a fair trade for a curve
 * that moves when the music does.
 */
export const FFT_SIZE = 2048;
export const MIN_FREQUENCY = 20;
export const MAX_FREQUENCY = 20000;
export const POINT_COUNT = 320;
export const WAVEFORM_POINT_COUNT = 96;
/**
 * How often the analyser is read, which is most of how late the picture is.
 *
 * This used to be `BALANCE_FRAME_INTERVAL_MS` — the Smart EQ measurement's
 * cadence — and the two have no reason to be the same number. Forty-five
 * milliseconds is a fine rate at which to accumulate minutes of listening; it
 * is a poor one at which to watch a kick, because the tick alone puts the
 * drawing up to a frame behind before anything eases it.
 *
 * Safe to shorten because the measurement is driven by elapsed time rather than
 * by frame count: it reads `timestampMs` and clamps the real delta, so more
 * frames give it the same answer in more pieces. The constant stays where it is
 * and keeps doing its other job, which is bounding a stalled tick.
 *
 * Thirty a second rather than fifty, and the difference is not taste. Every
 * tick publishes into a context and re-renders the chart, so the tick is also a
 * render budget: at twenty milliseconds a render that overruns means the next
 * tick lands before the queue has drained, the chain never breaks, and React
 * gives up with "Maximum update depth exceeded" — which it did. Thirty-three
 * leaves room for a slow frame to catch up, and against the forty-five this
 * replaced it still takes a quarter off the delay before the smoothing below
 * takes its own share.
 */
export const UPDATE_INTERVAL_MS = 33;

// The live trace shows real decibels referenced to THE TRACK, not to the
// volume knob. Windows loopback carries whatever volume is set, so an absolute
// dBFS scale would make the curve collapse the moment the user turns the
// system down — which says nothing about the music.
//
// Instead a slow peak-follower tracks the programme's own level and becomes
// the 0 dB line at the top of the plot. Every dB below that is a real dB below
// the track's own peak, so the shape and the height both mean something at any
// volume. Actual distortion is detected separately, from railed samples, so
// clipping still shows even though the reference moves.
export const LIVE_FULL_SCALE_DB = MAX_GAIN;
/**
 * Reference release, in dB per frame. Rises instantly to a new peak so a louder
 * passage cannot overshoot the top, then falls about 1 dB per second — slow
 * enough to ride out a quiet bar, fast enough to follow a track change within a
 * few seconds.
 *
 * Derived from the tick rather than written as a number, because it is a rate
 * per frame and the frames got shorter. Left at the old 0.045 it would have
 * fallen at two and a half dB a second the moment the interval was cut, which
 * is the sort of thing that changes how the whole plot behaves while looking
 * like a performance fix.
 */
export const TRACK_REFERENCE_RELEASE_DB = UPDATE_INTERVAL_MS / 1000;
/** Below this the output is silence; there is no meaningful shape to show. */
export const LIVE_SILENCE_DB = -95;

/**
 * The level meter's window, and the one number in this file that must not be
 * shortened.
 *
 * The meter reads sample peaks out of `getFloatTimeDomainData`, which hands back
 * the most recent `fftSize` samples and nothing older. At 48kHz, 2048 samples is
 * 42ms — comfortably more than the 33ms between ticks, so every sample the
 * output produced is seen by at least one read. Halve it and the window stops
 * covering the gap: a transient that lands in the missing eleven milliseconds is
 * never measured at all, and the meter silently under-reads the exact events it
 * exists to catch.
 *
 * No smoothing on these analysers, unlike the spectrum's. The FFT's averaging is
 * there to stop a jittery bin from making a noisy curve; a peak reading has no
 * such problem, and blending it with the previous block is just a slower attack
 * bolted on underneath the ballistics that are supposed to own it.
 */
export const LEVEL_FFT_SIZE = 2048;
/**
 * How many channels the meter will ever show.
 *
 * Two, and taken off the front of whatever the endpoint delivers. A surround
 * mix down-mixes discretely through the splitter, so those two are front left
 * and front right rather than a fold-down of six — which is the honest reading
 * for a meter, since it is those two that are about to clip the headphones.
 */
export const METER_CHANNELS = 2;

/** Shared empty, so a stopped capture never mints a fresh array. */
export const NO_LEVELS: IOutputLevel[] = [];

/**
 * Digital full scale, in the 0..255 byte domain the analyser reports.
 * A run of samples pinned to either rail is the signature of a signal that has
 * been clipped somewhere upstream — usually too much EQ boost or preamp.
 */
export const CLIP_RAIL_LOW = 1;
export const CLIP_RAIL_HIGH = 254;
/** Consecutive railed samples before it counts. One is just a loud peak. */
export const CLIP_RUN_LENGTH = 3;
/** How long a clip indication stays up after the last railed frame. */
export const CLIP_HOLD_MS = 1200;

export const detectClipping = (timeDomainData: Uint8Array): boolean => {
  let run = 0;
  for (let index = 0; index < timeDomainData.length; index += 1) {
    const sample = timeDomainData[index];
    if (sample <= CLIP_RAIL_LOW || sample >= CLIP_RAIL_HIGH) {
      run += 1;
      if (run >= CLIP_RUN_LENGTH) {
        return true;
      }
    } else {
      run = 0;
    }
  }
  return false;
};

/** Wall-clock silence after which the capture status says so. */
export const SILENCE_HINT_MS = 3000;
/** Wall-clock silence after which the capture gives up rather than hang. */
export const SILENCE_ABORT_MS = 15000;
/**
 * Independent wall-clock backstop. Every other timer counts *listened* time,
 * which stops advancing entirely if the renderer is starved; this guarantees
 * the promise settles even then.
 */
export const WATCHDOG_MS = 120000;

/**
 * How soon a failed capture is tried again, and how many times.
 *
 * Doubling, and finite. A capture that fails once has usually lost a race —
 * the endpoint is mid-switch, Windows has not finished handing the device
 * over — and trying again shortly afterwards is exactly right.
 *
 * A capture that fails forever is a different situation and used to get the
 * same answer: every 2.5 seconds, for as long as the window stayed open.
 * Windows Graphics Capture denies the window on some setups — `CreateForWindow
 * failed with hr: -2147024891`, which is E_ACCESSDENIED — and each attempt
 * negotiated a fresh capture session, was refused, and logged two errors on
 * the way out. Nothing about the tenth attempt was more likely to succeed than
 * the second; it just made the log unreadable and kept Chromium busy.
 *
 * Six attempts over roughly a minute and a half covers every transient cause,
 * and stopping after that is the honest answer: the wave has no data, which
 * the graph already says by drawing nothing.
 */
export const START_RETRY_MS = 2500;
export const MAX_START_RETRIES = 6;

/**
 * How long a muted capture is given before it is treated as a lost device.
 *
 * Long enough that ordinary gaps — a track change, a stream buffering, the
 * moment Equalizer APO reloads its config — pass without a restart, and short
 * enough that somebody who has just reinstalled the audio engine does not sit
 * watching a flat line wondering whether the app noticed.
 */
export const DEVICE_LOST_GRACE_MS = 2500;

/**
 * How long to let an output switch settle before grabbing the loopback again.
 *
 * Main says the endpoint changed as soon as it has loaded that output's
 * profile, which is earlier than Windows finishes handing the endpoint over.
 * Re-grabbing immediately can bind the new capture to the device being left —
 * the same race the start retry exists for, except that this one *succeeds*,
 * so nothing retries and the trace sits flat on an output nobody is listening
 * to any more.
 *
 * Short enough not to be seen as a gap, long enough to be on the other side of
 * the switch.
 */
export const OUTPUT_SWITCH_SETTLE_MS = 450;

/** Log-spaced analysis frequencies. Constant for a given sample rate. */
export const createFrequencyAxis = (sampleRate: number): number[] => {
  const logMin = Math.log10(MIN_FREQUENCY);
  const logMax = Math.log10(Math.min(MAX_FREQUENCY, sampleRate / 2));
  return Array.from(
    { length: POINT_COUNT },
    (_value, index) =>
      10 ** (logMin + (index / (POINT_COUNT - 1)) * (logMax - logMin)),
  );
};

/**
 * Buffers for a frame of curve or waveform, allocated once per capture and
 * filled in place.
 *
 * The pump publishes 320 points and 96 waveform samples ~22 times a second.
 * Building them fresh meant roughly 7,100 short-lived point objects a second
 * for a curve where only the numbers changed. They come in pairs because React
 * still needs a changed array identity to re-render: the pump alternates, so
 * the array React is holding is never the one being overwritten.
 */
export interface IFrameBuffers {
  points: [IChartPointData[], IChartPointData[]];
  waveform: [number[], number[]];
}

export const createFrameBuffers = (): IFrameBuffers => {
  const makePoints = () =>
    Array.from({ length: POINT_COUNT }, () => ({ x: 0, y: 0 }));
  return {
    points: [makePoints(), makePoints()],
    waveform: [
      new Array(WAVEFORM_POINT_COUNT).fill(0),
      new Array(WAVEFORM_POINT_COUNT).fill(0),
    ],
  };
};

/** Shared empties, so silence and teardown never mint a fresh array. */
export const NO_POINTS: IChartPointData[] = [];
export const NO_WAVEFORM: number[] = [];

export const writeFrequencyPoints = (
  target: IChartPointData[],
  axis: number[],
  levels: Float64Array,
  trackReferenceDb: number,
): IChartPointData[] => {
  for (let index = 0; index < target.length; index += 1) {
    const level = levels[index];
    // The track's own peak lands on the top gridline; everything below it is
    // a real dB below that peak.
    const plotted = Number.isFinite(level)
      ? level - trackReferenceDb + LIVE_FULL_SCALE_DB
      : MIN_GAIN;
    const point = target[index];
    point.x = axis[index];
    point.y = Math.min(MAX_GAIN, Math.max(MIN_GAIN, plotted));
  }
  return target;
};

/** Loudest finite bin in the frame, or undefined when the output is silent. */
export const getPeakLevel = (
  frequencyData: Float32Array,
): number | undefined => {
  let peak = -Infinity;
  for (let index = 0; index < frequencyData.length; index += 1) {
    const level = frequencyData[index];
    if (Number.isFinite(level) && level > peak) {
      peak = level;
    }
  }
  return peak > LIVE_SILENCE_DB ? peak : undefined;
};

export const writeWaveformPoints = (
  target: number[],
  timeDomainData: Uint8Array,
): number[] => {
  const bucketSize = timeDomainData.length / WAVEFORM_POINT_COUNT;
  for (let index = 0; index < WAVEFORM_POINT_COUNT; index += 1) {
    const start = Math.floor(index * bucketSize);
    const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
    let peak = 0;
    for (let sampleIndex = start; sampleIndex < end; sampleIndex += 1) {
      peak = Math.max(peak, Math.abs(timeDomainData[sampleIndex] - 128) / 128);
    }
    target[index] = peak;
  }
  return target;
};

// Handed a translator rather than reaching for one: this is a plain async
// function outside the component, so it cannot call a hook.
export const captureSystemOutput = async (
  t: Translate,
): Promise<MediaStream> => {
  if (!navigator.mediaDevices) {
    throw new Error(t('eq.smart.error.noCapture'));
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
