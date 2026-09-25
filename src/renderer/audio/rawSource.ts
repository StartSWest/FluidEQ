/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ANALYSIS_BINS } from 'common/dsp/analysisWire';
import type { TranslationKey } from 'common/i18n';
import {
  createAxisCells,
  readAbsoluteLevels,
} from '../utils/autoBalanceCapture';
import { createFrequencyAxis, getPeakLevel } from '../graph/liveSpectrumFrames';
import openRemoteAudioPort from '../remoteAudio/openRemoteAudioPort';
import {
  SENDER_SPECTRUM_SIZE,
  type ISenderSpectrum,
} from '../remoteAudio/senderSpectrum';
import { readDspSampleRate } from '../dsp/store';
import claimHostAnalysis from '../dsp/hostAnalysisClaim';

/**
 * The sound before FluidEQ processes it, as frames Smart EQ can measure.
 *
 * Smart EQ corrects the record, so it has to hear the record: not the bands,
 * not a voicing, not the rack, not its own last answer. The endpoint's
 * loopback — what the graph draws — carries all of those, because it is the
 * mix on its way to the device. Two taps do not:
 *
 *   `host`    — the Library plays through FluidEQ's own host, and the host
 *               meters its rack's input for the DSP page. That tap is the
 *               decoded file before any stage of the rack, on both engines.
 *   `process` — everything else plays through some other program, and
 *               Windows' process loopback delivers the mix of every process
 *               BEFORE the endpoint's effects: neither Equalizer APO nor the
 *               FluidEQ Engine is in it. The LAN sender relies on the same
 *               fact, and it was measured on this machine on 2026-09-22
 *               against the ordinary loopback taken at the same moment —
 *               see `startRawSourceCapture`.
 *
 * Neither is asked for on a clock. The host pushes a window each time its
 * rack has processed one; the process loopback's spectrum worker publishes a
 * window each time a window's worth of samples has arrived. The audio is the
 * cadence.
 *
 * Every frame lands on the analyser's own axis at the analyser's own scale,
 * so the accumulator behind it needs no idea which tap it is hearing.
 */
export type TRawSourceKind = 'host' | 'process';

export interface IRawSourceFrame {
  /** The analysis axis these levels sit on, in Hz. */
  axis: number[];
  /** Absolute level at each axis point, in dB — the analyser's own scale. */
  levels: Float64Array;
  /** The loudest bin, in the same scale; undefined for silence. */
  peakDb: number | undefined;
  sampleRate: number;
}

export interface IRawSourceOptions {
  kind: TRawSourceKind;
  onFrame: (frame: IRawSourceFrame) => void;
  /** The tap went away on its own; the measurement it fed is over. */
  onLost: (reason: TranslationKey) => void;
}

/** Turns one FFT frame of `bins` dB values into a frame on the axis. */
const createFrameBuilder = (fftSize: number) => {
  let sampleRate = 0;
  let axis: number[] = [];
  let cells: ReturnType<typeof createAxisCells> = [];
  let levels = new Float64Array(0);
  return (bins: Float32Array, rate: number): IRawSourceFrame => {
    if (rate !== sampleRate) {
      sampleRate = rate;
      axis = createFrequencyAxis(rate);
      cells = createAxisCells(axis, rate, fftSize);
      levels = new Float64Array(axis.length);
    }
    readAbsoluteLevels(bins, cells, levels);
    return { axis, levels, peakDb: getPeakLevel(bins), sampleRate };
  };
};

const openHostSource = async ({
  onFrame,
}: IRawSourceOptions): Promise<() => void> => {
  const bridge = window.electron?.ipcRenderer;
  if (
    typeof bridge?.setDspHostAnalysis !== 'function' ||
    typeof bridge?.onDspHostAnalysis !== 'function'
  ) {
    throw new Error('eq.smart.error.noSource');
  }
  const release = await claimHostAnalysis(bridge);
  const build = createFrameBuilder(ANALYSIS_BINS * 2);
  const unsubscribe = bridge.onDspHostAnalysis((frame) => {
    // The rack's input: after the restoration stage, which is off for nearly
    // everybody and, on, removes hiss that was never the music.
    const bins = frame.spectra.denoise;
    if (bins) {
      onFrame(build(bins, readDspSampleRate()));
    }
  });
  return () => {
    unsubscribe();
    release();
  };
};

const openProcessSource = async ({
  onFrame,
  onLost,
}: IRawSourceOptions): Promise<() => void> => {
  const bridge = window.electron?.ipcRenderer;
  if (
    typeof bridge?.setRawSourceCapture !== 'function' ||
    typeof bridge?.onRawSourceLost !== 'function'
  ) {
    throw new Error('eq.smart.error.noSource');
  }
  const abort = new AbortController();
  const worker = new Worker(
    new URL(
      process.env.NODE_ENV === 'production'
        ? './sender-spectrum.js'
        : '/sender-spectrum.dev.js',
      window.location.href,
    ),
  );
  const build = createFrameBuilder(SENDER_SPECTRUM_SIZE);
  let closed = false;
  const close = () => {
    if (closed) {
      return;
    }
    closed = true;
    abort.abort();
    worker.terminate();
    bridge.setRawSourceCapture(false).catch(() => undefined);
  };
  const unsubscribeLost = bridge.onRawSourceLost(() => {
    close();
    onLost('eq.smart.error.noSource');
  });
  worker.onmessage = ({ data }: MessageEvent<ISenderSpectrum>) => {
    if (!closed) {
      onFrame(build(data.frequency, data.sampleRate));
    }
  };
  worker.onerror = () => {
    close();
    onLost('eq.smart.error.noSource');
  };
  try {
    // The port first, so no chunk can arrive before something is listening.
    const port = await openRemoteAudioPort('source', abort.signal);
    worker.postMessage({ kind: 'attach', port, stream: true }, [port]);
    const opened = await bridge.setRawSourceCapture(true);
    if (!opened) {
      throw new Error('eq.smart.error.noSource');
    }
  } catch (error) {
    unsubscribeLost();
    close();
    throw error;
  }
  return () => {
    unsubscribeLost();
    close();
  };
};

/**
 * Open the tap and start delivering frames. Resolves with the way to close
 * it; rejects with an `Error` whose message is a translation key when the
 * tap cannot be opened at all.
 */
export const openRawSource = (
  options: IRawSourceOptions,
): Promise<() => void> =>
  options.kind === 'host'
    ? openHostSource(options)
    : openProcessSource(options);
