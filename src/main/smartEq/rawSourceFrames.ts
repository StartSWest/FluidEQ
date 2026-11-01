/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  ANALYSIS_BINS,
  type IHostAnalysis,
} from '../../common/dsp/analysisWire';
import type { TranslationKey } from '../../common/i18n';
import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';
import {
  SENDER_SPECTRUM_SIZE,
  createSenderSpectrum,
} from '../../common/senderSpectrum';
import {
  type IRawSourceFrame,
  createFrameBuilder,
} from '../../common/smartEqMeasurement';

/**
 * The sound before FluidEQ processes it, as frames Smart EQ can measure.
 *
 * Smart EQ corrects the record, so it has to hear the record: not the bands,
 * not a voicing, not the rack, not its own last answer. The endpoint's
 * loopback — what the graph draws — carries all of those, because it is the
 * mix on its way to the device. Two taps do not:
 *
 *   `host`    — the Library plays through FluidEQ's own host, and the host
 *               meters its rack's input. That tap is the decoded file before
 *               any stage of the rack, on both engines.
 *   `process` — everything else plays through some other program, and
 *               Windows' process loopback delivers the mix of every process
 *               BEFORE the endpoint's effects: neither Equalizer APO nor the
 *               FluidEQ Engine is in it (`startRawSourceCapture`).
 *
 * Neither is asked for on a clock. The host pushes a window each time its
 * rack has processed one; the process loopback's spectrum is read each time a
 * window's worth of new samples has arrived. The audio is the cadence.
 */
export type TRawSourceKind = 'host' | 'process';

export interface IRawSourceTaps {
  /** The process loopback's chunks until closed — `startRawSourceCapture`. */
  startProcessCapture: (
    onAudio: (chunk: ILanRemoteAudioChunk) => void,
    onFailure: () => void,
  ) => Promise<{ close: () => void }>;
  /** The host's analysis frames until stopped, or undefined if it cannot. */
  listenToHost: (
    listener: (analysis: IHostAnalysis) => void,
  ) => Promise<(() => void) | undefined>;
  /** The rate the host plays at. */
  hostSampleRate: () => number;
}

export interface IRawSourceOptions {
  kind: TRawSourceKind;
  onFrame: (frame: IRawSourceFrame) => void;
  /** The tap went away on its own; the measurement it fed is over. */
  onLost: (reason: TranslationKey) => void;
}

const NO_SOURCE: TranslationKey = 'eq.smart.error.noSource';

const openHostSource = async (
  taps: IRawSourceTaps,
  { onFrame }: IRawSourceOptions,
): Promise<() => void> => {
  const build = createFrameBuilder(ANALYSIS_BINS * 2);
  const stop = await taps.listenToHost((analysis) => {
    // The rack's input: after the restoration stage, which is off for nearly
    // everybody and, on, removes hiss that was never the music.
    const bins = analysis.spectra.denoise;
    const rate = taps.hostSampleRate();
    if (bins && rate > 0) {
      onFrame(build(bins, rate));
    }
  });
  if (!stop) {
    throw new Error(NO_SOURCE);
  }
  return stop;
};

const openProcessSource = async (
  taps: IRawSourceTaps,
  { onFrame, onLost }: IRawSourceOptions,
): Promise<() => void> => {
  const spectrum = createSenderSpectrum();
  const build = createFrameBuilder(SENDER_SPECTRUM_SIZE);
  // A frame goes out once a whole window of new samples has arrived since
  // the last one: the audio is the clock, and nothing samples on a timer.
  let sinceLast = 0;
  let closed = false;
  // A capture that cannot start is no source to measure, whatever the
  // helper said about why.
  const capture = await taps
    .startProcessCapture(
      (chunk) => {
        if (closed) {
          return;
        }
        spectrum.push(chunk);
        sinceLast += chunk.frames;
        if (sinceLast < SENDER_SPECTRUM_SIZE) {
          return;
        }
        const latest = spectrum.read();
        if (latest) {
          sinceLast = 0;
          onFrame(build(latest.frequency, latest.sampleRate));
        }
      },
      () => {
        if (!closed) {
          closed = true;
          onLost(NO_SOURCE);
        }
      },
    )
    .catch(() => {
      throw new Error(NO_SOURCE);
    });
  return () => {
    closed = true;
    capture.close();
  };
};

/**
 * Open the tap and start delivering frames. Resolves with the way to close
 * it; rejects with an `Error` whose message is a translation key when the
 * tap cannot be opened at all.
 */
export const openRawSourceFrames = (
  taps: IRawSourceTaps,
  options: IRawSourceOptions,
): Promise<() => void> =>
  options.kind === 'host'
    ? openHostSource(taps, options)
    : openProcessSource(taps, options);
