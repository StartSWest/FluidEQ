import {
  SCENE_TIME_WRAP_S,
  SPECTRUM_TEXELS,
  WAVEFORM_TEXELS,
} from 'common/sceneUniformContract';
import type { ISceneRhythm } from 'common/sceneRhythm';
import type { TWallpaperMotion } from 'common/wallpaper';
import type { ISceneFrame } from '../graph/sceneGl';

/**
 * What a desktop background set to Calm hears instead of the music.
 *
 * Not silence. A scene is built to answer music, and in silence most of them
 * rest: the aurora's curtains fall, the bars lie flat, the flowers close — a
 * still picture, which is not what somebody asking for a quiet animation
 * wants on a desktop. Nor any real sound: nothing here is played or captured,
 * and the music never reaches a calm background at all.
 *
 * This is the shape of a soft ambient passage — a low, even body with no beat
 * in it, swelling and settling over many seconds — so every scene keeps its
 * own motion at the quiet end of its range, and nothing in it can kick, flash
 * or trigger a musical accent. Every swell and every drift completes a whole
 * number of cycles in the scene clock's hour (`SCENE_TIME_WRAP_S`), so the
 * clock wrapping back to zero moves nothing.
 */

const TAU = Math.PI * 2;

/** A slow swell of `periodS` seconds, which divides the scene clock's hour. */
const swell = (seconds: number, periodS: number, phase: number) =>
  Math.sin((seconds / periodS) * TAU + phase);

export interface ICalmBands {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** The breath the levels are riding, 0..1, for the spectrum to swell with. */
  breath: number;
}

const smoothstep = (from: number, to: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/**
 * Breaths come in pairs, one of seven seconds and one of nine, so the rhythm
 * reads as breathing and never as a very slow beat.
 */
const BREATH_PAIR_S = 16;
const FIRST_BREATH_S = 7;

/**
 * 0..1 through one breath: in over its first two fifths, out over the rest,
 * with no corner where one breath runs into the next.
 */
const breathAt = (seconds: number) => {
  const inPair = ((seconds % BREATH_PAIR_S) + BREATH_PAIR_S) % BREATH_PAIR_S;
  const phase =
    inPair < FIRST_BREATH_S
      ? inPair / FIRST_BREATH_S
      : (inPair - FIRST_BREATH_S) / (BREATH_PAIR_S - FIRST_BREATH_S);
  return smoothstep(0, 0.4, phase) * (1 - smoothstep(0.4, 1, phase));
};

/**
 * The four levels at `seconds`. All three bands ride one breath, the higher
 * ones a little behind the bass the way a swell climbs a chord, and each
 * wanders on slow periods of its own so no two breaths look alike; how deep
 * a breath goes changes over most of a minute. At its deepest it reaches the
 * middle of what real music measured through the capture (level 0.2-0.43,
 * mid 0.15-0.46, treble 0-0.14), and between breaths it rests near the floor.
 */
export const calmBands = (seconds: number): ICalmBands => {
  const depth = 0.75 + 0.25 * swell(seconds, 48, 0.9);
  const breath = breathAt(seconds) * depth;
  return {
    level:
      0.17 +
      0.13 * breath +
      0.03 * swell(seconds, 15, 0) +
      0.02 * swell(seconds, 36, 1.3),
    bass:
      0.28 +
      0.2 * breath +
      0.05 * swell(seconds, 12, 0.4) +
      0.03 * swell(seconds, 30, 2.1),
    mid:
      0.2 +
      0.14 * breathAt(seconds - 0.7) * depth +
      0.05 * swell(seconds, 9, 1.7) +
      0.03 * swell(seconds, 24, 0.2),
    treble:
      0.07 +
      0.07 * breathAt(seconds - 1.4) * depth +
      0.03 * swell(seconds, 7.5, 3.1) +
      0.01 * swell(seconds, 20, 0.8),
    breath,
  };
};

const gaussian = (x: number, centre: number, width: number) =>
  Math.exp(-(((x - centre) / width) ** 2));

/** A repeatable 0..1 value for one knot of the drift at one of its steps. */
const hashed = (knot: number, step: number) => {
  const value = Math.sin(knot * 12.9898 + step * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/**
 * How often the spectrum's drift picks new heights, eased between: 0.6 a
 * second, slow enough that no bar is seen to jump. Counted per hour first, so
 * the clock's wrap lands exactly on a step.
 */
const DRIFT_STEPS_PER_WRAP = 2160;
const DRIFT_STEPS_PER_S = DRIFT_STEPS_PER_WRAP / SCENE_TIME_WRAP_S;
/** Texels between the drift's knots: neighbours differ, but never jaggedly. */
const DRIFT_KNOT_TEXELS = 6;

const driftAt = (texel: number, step: number, eased: number) => {
  const knot = texel / DRIFT_KNOT_TEXELS;
  const low = Math.floor(knot);
  const along = knot - low;
  const next = (step + 1) % DRIFT_STEPS_PER_WRAP;
  const at = (index: number) =>
    hashed(index, step) * (1 - eased) + hashed(index, next) * eased;
  return at(low) * (1 - along) + at(low + 1) * along;
};

/**
 * The spectrum: music's downward tilt, the three bands where they live in
 * hertz, and two gentle waves travelling through it over a slow drift — so
 * anything that reads the spectrum has something to follow, unhurried.
 */
export const fillCalmSpectrum = (
  bands: ICalmBands,
  seconds: number,
  spectrum: Uint8Array,
) => {
  const clock = (seconds * DRIFT_STEPS_PER_S) % DRIFT_STEPS_PER_WRAP;
  const step = Math.floor(clock);
  const blend = clock - step;
  const eased = blend * blend * (3 - 2 * blend);
  for (let texel = 0; texel < SPECTRUM_TEXELS; texel += 1) {
    const f = texel / (SPECTRUM_TEXELS - 1);
    const flow =
      0.5 +
      0.28 * swell(seconds, 15, f * 9) +
      0.22 * swell(seconds, 24, 1.1 - f * 23);
    const tilt = Math.max(0, 0.6 - 0.52 * f);
    const energy =
      tilt *
        (0.5 + 0.28 * flow + 0.22 * driftAt(texel, step, eased)) *
        (0.7 + 0.4 * bands.breath) +
      0.45 * bands.bass * gaussian(f, 0.14, 0.1) +
      0.32 * bands.mid * gaussian(f, 0.48, 0.14) +
      0.28 * bands.treble * gaussian(f, 0.8, 0.12);
    spectrum[texel] = Math.round(Math.min(1, energy) * 255);
  }
};

/** The waveform's envelope: the level, rolling slowly along the window. */
export const fillCalmWaveform = (
  bands: ICalmBands,
  seconds: number,
  waveform: Uint8Array,
) => {
  for (let sample = 0; sample < WAVEFORM_TEXELS; sample += 1) {
    const t = sample / (WAVEFORM_TEXELS - 1);
    const roll =
      0.55 + 0.45 * swell(seconds, 7.5, t * 7) * swell(seconds, 18, -t * 2.3);
    waveform[sample] = Math.round(
      Math.min(1, (0.12 + bands.level) * roll) * 255,
    );
  }
};

/**
 * How long a background already playing takes to hand over between the music
 * and the calm motion when it is switched: long enough to read as one becoming
 * the other rather than a cut, and over at a known moment — an eased approach
 * never quite arrived, and left a sliver of the music mixed in for seconds.
 */
const HANDOFF_MS = 1500;

/**
 * How fast the music's flywheel (`uMusicRun`) turns while calm: a turn in
 * fifty seconds, the quiet end of what music winds it to (it is capped at
 * 0.085 turns a second), so a scene carried by it keeps moving, unhurried.
 */
export const CALM_RUN_TURNS = 0.02;

/**
 * The music's time as a calm background hears it: nothing kicks, builds or
 * drops, the song has no intensity, and the beat is sure of nothing — so a
 * dancer weighted by that certainty comes to rest rather than freezing mid
 * step. `keep` is how much of the music is left. The clocks run on untouched.
 */
const quietened = (rhythm: ISceneRhythm, keep: number): ISceneRhythm => ({
  ...rhythm,
  confidence: rhythm.confidence * keep,
  kick: rhythm.kick * keep,
  snare: rhythm.snare * keep,
  hat: rhythm.hat * keep,
  intensity: rhythm.intensity * keep,
  build: rhythm.build * keep,
  drop: rhythm.drop * keep,
});

/** `turns` brought inside -0.5..0.5: the shorter way round. */
const nearestTurn = (turns: number) => turns - Math.round(turns);

export interface ICalmShaper {
  /** Which the scene should be hearing; the change eases in. */
  setMotion(motion: TWallpaperMotion): void;
  /** The frame the scene gets instead of `heard`, one frame on. */
  shape(heard: ISceneFrame): ISceneFrame;
}

/**
 * The scene runner's `shapeFrame` for a desktop background: the music as
 * heard while it follows the music, the calm motion while it is calm, and a
 * mix of the two only while one is handing over to the other. Writes into
 * buffers of its own, so the runner's are never bent in place.
 */
export const createCalmShaper = (initial: TWallpaperMotion): ICalmShaper => {
  let target = initial === 'calm' ? 1 : 0;
  // How far the handoff has got, 0 the music and 1 calm. Starts where it is
  // going: a background set to Calm opens calm.
  let progress = target;
  const calmSpectrum = new Uint8Array(SPECTRUM_TEXELS);
  const calmWaveform = new Uint8Array(WAVEFORM_TEXELS);
  const mixedSpectrum = new Uint8Array(SPECTRUM_TEXELS);
  const mixedWaveform = new Uint8Array(WAVEFORM_TEXELS);
  // The flywheel is shown as the music's own angle plus this offset, which
  // only calm moves: the angle never jumps as calm comes in or as the music
  // takes it back, and it stays wherever calm left it relative to the music.
  let runOffset = 0;
  let lastRun: number | undefined;

  /** The flywheel as shown: the music's while it plays, calm's pace in calm. */
  const followRun = (
    heard: ISceneFrame['musicRun'],
    presence: number,
    elapsedMs: number,
  ): ISceneFrame['musicRun'] => {
    const [angle, speed] = heard;
    // How far the music turned it since the last frame; nothing while it is
    // paused, which is when a calm background still has to keep turning.
    const turned = lastRun === undefined ? 0 : nearestTurn(angle - lastRun);
    lastRun = angle;
    runOffset = nearestTurn(
      runOffset + presence * ((CALM_RUN_TURNS * elapsedMs) / 1000 - turned),
    );
    if (runOffset === 0 && presence === 0) {
      return heard;
    }
    const shown = angle + runOffset;
    return [
      shown - Math.floor(shown),
      speed + (CALM_RUN_TURNS - speed) * presence,
    ];
  };

  const mixInto = (
    out: Uint8Array,
    from: Uint8Array,
    to: Uint8Array,
    amount: number,
  ) => {
    for (let index = 0; index < out.length; index += 1) {
      out[index] = Math.round(from[index] + (to[index] - from[index]) * amount);
    }
    return out;
  };

  return {
    setMotion: (motion) => {
      target = motion === 'calm' ? 1 : 0;
    },
    shape: (heard) => {
      const elapsedMs = Math.max(0, heard.deltaMs ?? 0);
      progress =
        target > progress
          ? Math.min(target, progress + elapsedMs / HANDOFF_MS)
          : Math.max(target, progress - elapsedMs / HANDOFF_MS);
      // Eased at both ends, so neither the music nor the calm motion is left
      // or reached with a visible kink.
      const presence = progress * progress * (3 - 2 * progress);
      const musicRun = followRun(heard.musicRun, presence, elapsedMs);
      if (progress === 0) {
        return musicRun === heard.musicRun ? heard : { ...heard, musicRun };
      }
      const bands = calmBands(heard.timeSeconds);
      fillCalmSpectrum(bands, heard.timeSeconds, calmSpectrum);
      fillCalmWaveform(bands, heard.timeSeconds, calmWaveform);
      // The music's events have no calm counterpart; they only fade. The
      // accent keeps its count, which is only a seed.
      const keep = 1 - presence;
      const events: Partial<ISceneFrame> = {
        musicAccent: [heard.musicAccent[0] * keep, heard.musicAccent[1]],
        musicRun,
        ...(heard.rhythm ? { rhythm: quietened(heard.rhythm, keep) } : {}),
        ...(heard.stereo
          ? { stereo: [heard.stereo[0] * keep, heard.stereo[1] * keep] }
          : {}),
      };
      if (progress === 1) {
        return {
          ...heard,
          ...events,
          // Nothing is played to a calm background: it rests, as any scene
          // played nothing does (`sceneRest.ts`), and its slow swells read
          // the same at thirty frames a second.
          playing: false,
          level: bands.level,
          beat: 0,
          bands: [bands.bass, bands.mid, bands.treble],
          spectrum: calmSpectrum,
          waveform: calmWaveform,
        };
      }
      const mix = (from: number, to: number) => from + (to - from) * presence;
      return {
        ...heard,
        ...events,
        level: mix(heard.level, bands.level),
        beat: heard.beat * keep,
        bands: [
          mix(heard.bands[0], bands.bass),
          mix(heard.bands[1], bands.mid),
          mix(heard.bands[2], bands.treble),
        ],
        spectrum: mixInto(
          mixedSpectrum,
          heard.spectrum,
          calmSpectrum,
          presence,
        ),
        waveform: mixInto(
          mixedWaveform,
          heard.waveform,
          calmWaveform,
          presence,
        ),
      };
    },
  };
};
