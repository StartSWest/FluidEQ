/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { JOURNAL_STEP_MS, type ISongMoment } from './songMap';
import type { ISoundHop } from './soundHops';
import type { ISpectrumEnergy } from './spectrumEnergy';

/**
 * The songs FluidEQ has heard, kept moment by moment from the music as the
 * Studio heard it for the member's AI (`songListener.ts`), for their maps
 * (`songMap.ts`): the song playing and
 * the one before it, a moment every JOURNAL_STEP_MS of music with each drum
 * hit and drop counted.
 *
 * WHERE A SONG ENDS is the player's to say when it names what it plays
 * (`playing`, from what Windows and FluidEQ's own players publish): a
 * playlist runs from one song into the next with no silence between them,
 * and a song paused and played again is still one song. For a player that
 * names nothing, the music stopping for long enough to part two songs ends
 * one (`running`, `sceneRhythm.ts`).
 */

/** The most kept of a song: ten minutes; a longer one keeps its last ten. */
const MOST_MOMENTS = (10 * 60 * 1_000) / JOURNAL_STEP_MS;
/**
 * Shorter than this, what was heard is not kept as the song before: a
 * notification, a track skipped past, the first moments of a song whose
 * player named it late.
 */
const LEAST_SONG_MS = 10_000;
/**
 * Music nobody heard for longer than this says nothing about how much of the
 * song went by, or whether it is still the same song: its time is not
 * counted. The Studio's listener is handed every sample and loses none; a
 * hearing that read its analysers too late would (`soundHops.ts`).
 */
const MOST_LOST_MS = 5_000;

export interface IHeardSongs {
  now: readonly ISongMoment[];
  before: readonly ISongMoment[];
}

export interface ISongJournal {
  /**
   * One step of the music - `hop`, and the reading after it - after
   * `lostMs` that nobody heard.
   */
  hear(
    reading: ISpectrumEnergy,
    hop: Pick<ISoundHop, 'stepMs' | 'bands'>,
    lostMs: number,
  ): void;
  /** The song a player says is playing; undefined while none names one. */
  playing(key: string | undefined): void;
  songs(): IHeardSongs;
  /** Whole seconds heard of the song playing now. */
  seconds(): number;
  /** Whether music was heard at the last step. */
  sounding(): boolean;
}

interface IRun {
  t: number;
  ms: number;
  /** The sound's power, from the rhythm bands' absolute levels. */
  power: number;
  level: number;
  bass: number;
  mid: number;
  treble: number;
  intensity: number;
  build: number;
  tempo: number;
  confidence: number;
  kicks: number;
  snares: number;
  hats: number;
  drops: number;
  voice: number;
  open: number;
  pitch: number;
}

const startRun = (t: number): IRun => ({
  t,
  ms: 0,
  power: 0,
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  intensity: 0,
  build: 0,
  tempo: 0,
  confidence: 0,
  kicks: 0,
  snares: 0,
  hats: 0,
  drops: 0,
  voice: 0,
  open: 0,
  pitch: 0,
});

/** The mean power of the rhythm bands, each 0..1 over 100 dB. */
const powerOf = (bands: ArrayLike<number>) => {
  let power = 0;
  for (let at = 0; at < bands.length; at += 1) {
    power += 10 ** ((bands[at] * 100 - 100) / 10);
  }
  return power / Math.max(1, bands.length);
};

/**
 * `changed` is told whenever `seconds` or `sounding` would answer
 * differently, or another song begins: once a second at most while music
 * plays, so a page can show it without asking on a clock.
 */
export const createSongJournal = (changed?: () => void): ISongJournal => {
  let now: ISongMoment[] = [];
  let before: ISongMoment[] = [];
  let run: IRun | undefined;
  /** How far into the song playing now the music heard has reached. */
  let songMs = 0;
  let key: string | undefined;
  let parted = false;
  let sounding = false;
  let told = { seconds: 0, sounding: false };

  const tell = () => {
    const seconds = Math.floor(songMs / 1_000);
    if (seconds !== told.seconds || sounding !== told.sounding) {
      told = { seconds, sounding };
      changed?.();
    }
  };

  const keep = () => {
    if (!run || run.ms <= 0) {
      run = undefined;
      return;
    }
    const { ms } = run;
    const of = (total: number) => total / ms;
    now.push({
      t: run.t / 1_000,
      loudness: 10 * Math.log10(Math.max(1e-10, of(run.power))),
      level: of(run.level),
      bass: of(run.bass),
      mid: of(run.mid),
      treble: of(run.treble),
      intensity: of(run.intensity),
      build: run.build,
      tempo: of(run.tempo),
      confidence: of(run.confidence),
      kicks: run.kicks,
      snares: run.snares,
      hats: run.hats,
      drops: run.drops,
      voice: of(run.voice),
      open: of(run.open),
      pitch: of(run.pitch),
    });
    if (now.length > MOST_MOMENTS) {
      now.shift();
    }
    run = undefined;
  };

  const begin = () => {
    keep();
    if (songMs >= LEAST_SONG_MS) {
      before = now;
    }
    now = [];
    songMs = 0;
    parted = false;
    tell();
  };

  return {
    hear: (reading, { stepMs, bands }, lostMs) => {
      const { rhythm, voice } = reading;
      sounding = rhythm.running;
      if (!rhythm.running) {
        keep();
        parted ||= key === undefined;
        tell();
        return;
      }
      if (parted) {
        begin();
      }
      if (lostMs > 0) {
        keep();
        if (lostMs <= MOST_LOST_MS) {
          songMs += lostMs;
        } else if (key === undefined) {
          begin();
        }
      }
      run ??= startRun(songMs);
      run.ms += stepMs;
      run.power += powerOf(bands) * stepMs;
      run.level += reading.level * stepMs;
      run.bass += reading.bass * stepMs;
      run.mid += reading.mid * stepMs;
      run.treble += reading.treble * stepMs;
      run.intensity += rhythm.intensity * stepMs;
      run.build = Math.max(run.build, rhythm.build);
      run.tempo += rhythm.tempo * stepMs;
      run.confidence += rhythm.confidence * stepMs;
      // A hit shown, and a drop landing, set their envelope to exactly 1 in
      // that very step (`rhythmKit.ts`, `rhythmSection.ts`); every step
      // after it decays.
      run.kicks += rhythm.kick === 1 ? 1 : 0;
      run.snares += rhythm.snare === 1 ? 1 : 0;
      run.hats += rhythm.hat === 1 ? 1 : 0;
      run.drops += rhythm.drop === 1 ? 1 : 0;
      run.voice += voice.sure * stepMs;
      run.open += voice.open * stepMs;
      run.pitch += voice.pitch * stepMs;
      songMs += stepMs;
      if (run.ms >= JOURNAL_STEP_MS) {
        keep();
      }
      tell();
    },
    playing: (next) => {
      if (next === key) {
        return;
      }
      const named = key !== undefined;
      key = next;
      // A player that stops naming songs leaves this one playing. One that
      // starts naming them names this one, late, unless what was heard
      // without a name was long enough to have been a song of its own.
      if (next !== undefined && (named || songMs >= LEAST_SONG_MS)) {
        begin();
      }
    },
    songs: () => ({ now, before }),
    seconds: () => Math.floor(songMs / 1_000),
    sounding: () => sounding,
  };
};
