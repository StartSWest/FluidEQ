/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useMemo, useRef } from 'react';
import type { IAnalysisNeeds } from 'common/graphAnalysis';
import { useLiveAudioControl } from '../../audio/LiveAudioContext';
import {
  createLiveGraphBand,
  readGraphLevels,
  type ILiveGraphBand,
} from '../liveGraphBand';

/**
 * The measurements the shared reading does not carry, built only while
 * something is drawing them.
 *
 * Three different things want three different taps off the capture:
 *
 *  - LEFT AND RIGHT, each with its own spectrum, for the split. The shared
 *    reading is one analyser on the summed signal, which is the right answer
 *    for one figure and no answer at all for two: a mix panned hard left and
 *    one panned hard right sum to the same spectrum.
 *  - THE SAMPLES themselves, per channel, for the oscilloscope, the
 *    goniometer and the correlation. No transform involved.
 *  - MID AND SIDE, each with its own spectrum. These have to be summed and
 *    subtracted in the SOUND, before either is transformed: a magnitude
 *    spectrum has thrown its phase away, so the mid cannot be recovered from
 *    the left and right spectra afterwards.
 *
 * Built on the graph band rather than on bare analysers wherever a spectrum
 * is wanted. A 2048-point transform cannot resolve anything under about
 * eighty hertz — its bins are twenty-three hertz wide — so a pair of them
 * would have drawn two channels that agreed about the treble and invented
 * the bass. `createLiveGraphBand` is the same joined pair of windows the
 * single reading already uses, which is what makes every figure here
 * comparable with every other and with it.
 */

/** The fast window, matched to the one the shared reading is taken with. */
const FAST_FFT_SIZE = 2048;

/** Left and right; a capture with more channels is still read as a pair. */
const CHANNELS = 2;

interface IPair {
  bands: ILiveGraphBand[];
  data: Float32Array<ArrayBuffer>[];
  fast: AnalyserNode[];
  /** When this pair was last transformed, on the display's clock. */
  readAt: number;
}

/**
 * How often a pair is actually transformed, in milliseconds.
 *
 * NOT every frame. The fast window is 2048 samples — 43 ms at 48 kHz — and
 * the long one is 32768, so a transform taken twice inside one window is a
 * transform of very nearly the same audio: the second one costs a full FFT
 * and returns the first one's answer. Measured in the running window, the
 * two extra long windows Mid & side needs were 150 ms of script per second
 * at display rate, five times the drawing itself.
 *
 * Twenty milliseconds is still faster than either window turns over, so
 * nothing is lost, and it caps the cost whatever the display runs at — a
 * 120 Hz panel was paying twice for the same numbers.
 */
const READ_EVERY_MS = 20;

interface IChannelReader {
  /** Per channel: the fast analyser and the block it is read into. */
  fast: AnalyserNode[];
  scope: Float32Array<ArrayBuffer>[];
  /** Each channel's own spectrum, when the split asked for it. */
  split?: IPair;
  /** The shared sound and the difference, when Mid & side asked for them. */
  midside?: IPair;
  teardown: () => void;
}

/** A tap at unity: what a splitter output has to go through to be a source. */
const tapOf = (context: AudioContext, gain: number): GainNode => {
  const tap = context.createGain();
  tap.gain.value = gain;
  return tap;
};

/**
 * A fast analyser on `source`, and a graph band beside it when a spectrum is
 * wanted rather than only the samples.
 */
const listen = (
  context: AudioContext,
  source: AudioNode,
  withBand: boolean,
): { analyser: AnalyserNode; band?: ILiveGraphBand } => {
  const analyser = context.createAnalyser();
  analyser.fftSize = FAST_FFT_SIZE;
  analyser.minDecibels = -100;
  analyser.maxDecibels = 0;
  // Averaged with the previous read by the node itself is exactly what the
  // look's own attack and release are for, and doing it twice reads as lag.
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);
  return {
    analyser,
    band: withBand
      ? createLiveGraphBand(context, source, FAST_FFT_SIZE)
      : undefined,
  };
};

const buildReader = (
  context: AudioContext,
  source: AudioNode,
  needs: IAnalysisNeeds,
): IChannelReader | undefined => {
  let splitter: ChannelSplitterNode | undefined;
  try {
    splitter = context.createChannelSplitter(CHANNELS);
    source.connect(splitter);
  } catch {
    // A capture that went away between the render and this effect. Nothing
    // is connected yet, so there is nothing to take down either.
    return undefined;
  }
  const nodes: AudioNode[] = [splitter];
  const fast: AnalyserNode[] = [];
  const splitBands: ILiveGraphBand[] = [];
  for (let channel = 0; channel < CHANNELS; channel += 1) {
    /**
     * A tap per channel, because a splitter hands a channel out of one of its
     * OUTPUTS and everything downstream connects from output zero. The gain
     * is the adapter, not a level.
     */
    const tap = tapOf(context, 1);
    splitter.connect(tap, channel);
    nodes.push(tap);
    const { analyser, band } = listen(context, tap, needs.split);
    fast.push(analyser);
    if (band) {
      splitBands.push(band);
    }
  }

  let midside: IPair | undefined;
  if (needs.midside) {
    /**
     * A `GainNode` sums everything connected to it, so the mid is both
     * channels into one at half, and the side is the same with the right
     * inverted. Halved so a centred record's mid is the record rather than
     * twice it, which is the same convention every mid/side tool uses.
     */
    const mid = tapOf(context, 1);
    const side = tapOf(context, 1);
    const half = [tapOf(context, 0.5), tapOf(context, 0.5)];
    const signed = [tapOf(context, 0.5), tapOf(context, -0.5)];
    for (let channel = 0; channel < CHANNELS; channel += 1) {
      splitter.connect(half[channel], channel);
      half[channel].connect(mid);
      splitter.connect(signed[channel], channel);
      signed[channel].connect(side);
    }
    nodes.push(mid, side, ...half, ...signed);
    const pair = [mid, side].map((node) => listen(context, node, true));
    midside = {
      readAt: 0,
      fast: pair.map((each) => each.analyser),
      data: pair.map(
        (each) => new Float32Array(each.analyser.frequencyBinCount),
      ),
      bands: pair.flatMap((each) => (each.band ? [each.band] : [])),
    };
  }

  return {
    fast,
    scope: fast.map((analyser) => new Float32Array(analyser.fftSize)),
    split:
      splitBands.length === CHANNELS
        ? {
            readAt: 0,
            bands: splitBands,
            fast,
            data: fast.map(
              (analyser) => new Float32Array(analyser.frequencyBinCount),
            ),
          }
        : undefined,
    midside,
    teardown: () => {
      [...splitBands, ...(midside?.bands ?? [])].forEach((band) =>
        band.lowAnalyser.disconnect(),
      );
      [...fast, ...(midside?.fast ?? [])].forEach((analyser) =>
        analyser.disconnect(),
      );
      nodes.forEach((node) => node.disconnect());
    },
  };
};

/** One pair's levels, transformed again only when they can have changed. */
const readPair = (
  pair: IPair | undefined,
): readonly [Float64Array, Float64Array] | undefined => {
  if (!pair || pair.bands.length < 2) {
    return undefined;
  }
  const now = performance.now();
  if (now - pair.readAt >= READ_EVERY_MS) {
    pair.readAt = now;
    for (let side = 0; side < 2; side += 1) {
      pair.fast[side].getFloatFrequencyData(pair.data[side]);
      readGraphLevels(pair.bands[side], pair.data[side]);
    }
  }
  // The band keeps its own levels between reads, so a frame that skipped the
  // transform draws the last one rather than nothing.
  return [pair.bands[0].levels, pair.bands[1].levels];
};

export interface IAnalysisChannels {
  /** Each channel's levels in dBFS per point, or nothing measured yet. */
  read: () => readonly [Float64Array, Float64Array] | undefined;
  /** The shared sound and the difference, on the same scale. */
  readMidSide: () => readonly [Float64Array, Float64Array] | undefined;
  /** One block of samples per channel. */
  scope: () => readonly [Float32Array, Float32Array] | undefined;
}

/**
 * `needs` is read on every render rather than captured: switching a look
 * between Joined and Left & right, or onto a view that wants the samples,
 * has to build or tear down analysers, and a hook that only looked once
 * would leave the second figure blank until the next track change.
 */
const useAnalysisChannels = (needs: IAnalysisNeeds): IAnalysisChannels => {
  const { capture } = useLiveAudioControl();
  const readerRef = useRef<IChannelReader | undefined>(undefined);
  // On the three booleans rather than on the object: the caller builds a
  // fresh one every render, and rebuilding the audio graph sixty times a
  // second is a click in somebody's music.
  const { split, scope, midside } = needs;
  const wanted = useMemo(
    () => ({ split, scope, midside }),
    [split, scope, midside],
  );

  useEffect(() => {
    if (!capture || (!wanted.split && !wanted.scope && !wanted.midside)) {
      return undefined;
    }
    const reader = buildReader(capture.context, capture.source, wanted);
    readerRef.current = reader;
    return () => {
      readerRef.current = undefined;
      reader?.teardown();
    };
  }, [wanted, capture]);

  const readRef = useRef<IAnalysisChannels>({
    read: () => readPair(readerRef.current?.split),
    readMidSide: () => readPair(readerRef.current?.midside),
    scope: () => {
      const reader = readerRef.current;
      if (!reader) {
        return undefined;
      }
      for (let channel = 0; channel < CHANNELS; channel += 1) {
        reader.fast[channel].getFloatTimeDomainData(reader.scope[channel]);
      }
      return [reader.scope[0], reader.scope[1]];
    },
  });
  return readRef.current;
};

export default useAnalysisChannels;
