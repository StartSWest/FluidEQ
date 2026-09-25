/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongJournal } from 'common/songJournal';
import {
  createSoundCursor,
  createSoundHops,
  soundHistorySamples,
  type ISoundCursor,
  type ISoundHop,
} from 'common/soundHops';
import {
  createEnergyState,
  hearSound,
  readEnergy,
  type ISpectrumEnergy,
} from 'common/spectrumEnergy';

/**
 * A capture's sound as its drawings hear it: every ten milliseconds of it
 * (`soundHops.ts`), and the music heard in those - levels, pulse, accent,
 * the flywheel and the rhythm (`spectrumEnergy.ts`) - worked out once for
 * every drawing in the window.
 *
 * ONCE, NOT ONCE PER DRAWING. The graph's scene, the Studio's stage and its
 * meters, and the ambient layer each kept a measurement of their own, fed
 * from their own frames: each had heard a different stretch of the song,
 * each learnt its tempo afresh whenever it was put on screen, and at any
 * moment two of them could disagree about whether a snare had just been
 * hit. Here there is one, and every drawing reads it at its own frame.
 *
 * Read when a drawing asks, and never on a clock of its own: the analysers
 * hold the last quarter of a second of samples (`soundHistorySamples`), so
 * a drawing that asks at 16 frames a second still misses nothing, and while
 * nothing asks - no scene on screen, the window minimised - nothing is
 * worked out. Time nobody asked about is counted as time lost, which the
 * rhythm knows how to take.
 */
export interface ILiveSound {
  /**
   * The hops `cursor` has not taken, the sound read up to now first: for a
   * drawing that measures them its own way (the Studio's Bass, Mids and
   * Treble, each part of the music on its own).
   */
  take(cursor: ISoundCursor): readonly ISoundHop[];
  /** The music as heard up to now: the same reading for every drawing. */
  music(): ISpectrumEnergy;
}

/**
 * The music heard in a capture's samples, however they reach it: read from
 * its analysers when a drawing asks (below), or handed over block by block
 * by the audio thread (`songListener.ts`).
 */
export interface ISoundHearing extends ILiveSound {
  /**
   * The latest samples: each channel's last soundHistorySamples, oldest
   * first, the last played at `atMs` (`soundHops.ts`).
   */
  update(left: Float32Array, right: Float32Array, atMs: number): void;
}

/** The sound's two channels, an analyser each, and the node they hang off. */
export interface ISoundAnalysers {
  /** What the source is connected to: the one connection to take down. */
  input: AudioNode;
  left: AnalyserNode;
  right: AnalyserNode;
}

/**
 * The analysers the sound is read from, beside the drawing's, on the same
 * source: always two channels, a single one spread to both - its right is
 * its left, and nothing stands apart from the middle - and more than two
 * folded down as speakers fold them.
 */
export const connectSoundAnalysers = (
  context: BaseAudioContext,
  source: AudioNode,
): ISoundAnalysers => {
  const input = context.createGain();
  input.channelCount = 2;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'speakers';
  const splitter = context.createChannelSplitter(2);
  source.connect(input);
  input.connect(splitter);
  const channel = (index: number) => {
    const analyser = context.createAnalyser();
    analyser.fftSize = soundHistorySamples(context.sampleRate);
    analyser.smoothingTimeConstant = 0;
    splitter.connect(analyser, index);
    return analyser;
  };
  return { input, left: channel(0), right: channel(1) };
};

/**
 * Hears the samples `update` is given, at `rate`; and, given a journal, keeps
 * every step of the music there, for the maps the member's AI reads of the
 * songs (`songJournal.ts`).
 */
export const createSoundHearing = (
  rate: number,
  journal?: ISongJournal,
): ISoundHearing => {
  const hops = createSoundHops(rate);
  const cursor = createSoundCursor();
  const energy = createEnergyState();
  let reading = readEnergy(energy);
  return {
    update: (left, right, atMs) => hops.update(left, right, atMs),
    take: (other) => hops.take(other),
    music: () => {
      // One hop at a time, so a journal keeps every step: a drum's hit is a
      // reading of exactly 1 in its own step, and gone by the next.
      hops.take(cursor).forEach((hop, index) => {
        const lostMs = index === 0 ? cursor.lostMs : 0;
        reading = hearSound(energy, [hop], lostMs);
        journal?.hear(reading, hop, lostMs);
      });
      return reading;
    },
  };
};

export const createLiveSound = (
  { left, right }: ISoundAnalysers,
  /** How much audio has been rendered, in ms; the analysers' own clock by default. */
  audioTimeMs: () => number = () => left.context.currentTime * 1000,
): ILiveSound => {
  const leftSamples = new Float32Array(left.fftSize);
  const rightSamples = new Float32Array(right.fftSize);
  const hearing = createSoundHearing(left.context.sampleRate);
  let readAt: number | undefined;
  // The analyser has something new only once another block of audio has been
  // rendered, so the context's clock is what says a read is worth doing.
  const refresh = () => {
    const at = audioTimeMs();
    if (at === readAt) {
      return;
    }
    readAt = at;
    left.getFloatTimeDomainData(leftSamples);
    right.getFloatTimeDomainData(rightSamples);
    hearing.update(leftSamples, rightSamples, at);
  };
  return {
    take: (other) => {
      refresh();
      return hearing.take(other);
    },
    music: () => {
      refresh();
      return hearing.music();
    },
  };
};
