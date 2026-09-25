import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { SPECTRUM_TEXELS, WAVEFORM_TEXELS } from 'common/sceneUniformContract';
import {
  BASS_HZ,
  MID_HZ,
  TREBLE_HZ,
  advanceEnergy,
  createEnergyState,
  type IEnergyState,
  type ISpectrumPoint,
} from 'common/spectrumEnergy';
import { MAX_FREQUENCY, MIN_FREQUENCY } from '../graph/liveSpectrumFrames';
import type { ISceneFrame } from '../graph/sceneGl';

/**
 * The Studio's test signals: what a scene hears when the member wants to
 * check one part of the music on its own.
 *
 * They replace only what the STAGE's scene receives. The audio is never
 * touched, nothing is played, and the graph beside the Studio keeps hearing
 * the real music. Silence matters most: a scene that keeps flashing in silence
 * is inventing music, and this is where that shows.
 *
 * Bass, mids and treble are the member's own music with everything else taken
 * out (`soloFrame`). They were made-up tones — a bass holding at three
 * quarters and swaying once every three seconds — and a scene tried on them
 * moved like nothing a song does, its bass meter crawling while the kick in
 * the speakers hit. The rest are made up, and built from the scene clock
 * rather than a timer, so a signal is exactly as smooth as the frames that
 * draw it.
 */

/**
 * `showcase` is everything at once: music-like, every channel busy, over
 * moving broadband noise. It is what a scene hears while its picture is
 * taken, so the picture shows it doing things rather than waiting for a
 * song, and the last of the test buttons, so a member can see the same.
 */
export type TStudioSignal =
  | 'live'
  | 'silence'
  | 'bass'
  | 'mid'
  | 'treble'
  | 'beat'
  | 'accent'
  | 'showcase';

export const STUDIO_SIGNALS: readonly TStudioSignal[] = [
  'live',
  'silence',
  'bass',
  'mid',
  'treble',
  'beat',
  'accent',
  'showcase',
];

const BEAT_PERIOD_S = 60 / 118;
/**
 * Longer than the longest gap the engine leaves between two musical accents
 * (7.2 s), so every onset in the accent signal is one the scene sees.
 */
export const ACCENT_PERIOD_S = 7.5;

interface IBands {
  level: number;
  beat: number;
  bass: number;
  mid: number;
  treble: number;
}

/** The parts of the music a member can hear on their own. */
type TSoloSignal = Extract<TStudioSignal, 'bass' | 'mid' | 'treble'>;

const SOLO_HZ: Record<TSoloSignal, readonly [number, number]> = {
  bass: BASS_HZ,
  mid: MID_HZ,
  treble: TREBLE_HZ,
};

const isSolo = (signal: TStudioSignal): signal is TSoloSignal =>
  signal in SOLO_HZ;

/** The made-up signals, which do not listen to the music at all. */
type TMadeSignal = Exclude<TStudioSignal, 'live' | TSoloSignal>;

/** 1 at an onset, falling to nothing over the rest of the period. */
const pulse = (seconds: number, period: number, sharpness: number) =>
  Math.exp(-((seconds % period) / period) * sharpness);

export const studioBands = (signal: TMadeSignal, seconds: number): IBands => {
  const hat = pulse(seconds, BEAT_PERIOD_S / 2, 11);
  const kick = pulse(seconds, BEAT_PERIOD_S, 7);
  switch (signal) {
    case 'silence':
      return { level: 0, beat: 0, bass: 0, mid: 0, treble: 0 };
    case 'beat':
      return {
        level: 0.4 + 0.2 * kick,
        beat: kick,
        bass: 0.42 + 0.4 * kick,
        mid: 0.36,
        treble: 0.18 + 0.42 * hat,
      };
    case 'showcase':
      // A loud, busy chorus: kick and bass together, a moving melody in the
      // mids, hats on the offbeats.
      return {
        level: 0.58 + 0.28 * kick,
        beat: kick,
        bass: 0.52 + 0.42 * kick,
        mid: 0.46 + 0.18 * Math.sin(seconds * 1.9) + 0.12 * hat,
        treble: 0.32 + 0.46 * hat,
      };
    case 'accent':
    default: {
      // A hard onset with the bass the engine requires, once a period.
      const onset = pulse(seconds, ACCENT_PERIOD_S, 14);
      return {
        level: 0.28 + 0.5 * onset,
        beat: onset,
        bass: 0.25 + 0.6 * onset,
        mid: 0.2 + 0.3 * onset,
        treble: 0.1,
      };
    }
  }
};

const gaussian = (x: number, centre: number, width: number) =>
  Math.exp(-(((x - centre) / width) ** 2));

/** Fills `spectrum` with the three bands laid out where they live in hertz. */
export const fillStudioSpectrum = (bands: IBands, spectrum: Uint8Array) => {
  for (let texel = 0; texel < SPECTRUM_TEXELS; texel += 1) {
    const f = texel / (SPECTRUM_TEXELS - 1);
    const energy =
      bands.bass * gaussian(f, 0.16, 0.12) +
      bands.mid * gaussian(f, 0.5, 0.16) +
      bands.treble * gaussian(f, 0.82, 0.13);
    spectrum[texel] = Math.round(Math.min(1, energy) * 255);
  }
};

/** A repeatable 0..1 value for a texel at one step of the noise's clock. */
const hashed = (texel: number, step: number) => {
  const value = Math.sin(texel * 12.9898 + step * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

/** Steps of the showcase noise per second; eased between, so it flows. */
const NOISE_STEPS_PER_S = 9;

/**
 * The showcase spectrum: the three bands where they live in hertz, over
 * broadband noise that tilts down toward the treble the way music does, and
 * moves every frame — so bars, peaks and anything reading the spectrum have
 * something to do.
 */
export const fillShowcaseSpectrum = (
  bands: IBands,
  seconds: number,
  spectrum: Uint8Array,
) => {
  const clock = seconds * NOISE_STEPS_PER_S;
  const step = Math.floor(clock);
  const blend = clock - step;
  const eased = blend * blend * (3 - 2 * blend);
  for (let texel = 0; texel < SPECTRUM_TEXELS; texel += 1) {
    const f = texel / (SPECTRUM_TEXELS - 1);
    const noise =
      hashed(texel, step) * (1 - eased) + hashed(texel, step + 1) * eased;
    const tilt = 0.62 - 0.4 * f;
    const energy =
      tilt * (0.45 + 0.55 * noise) * (0.6 + 0.4 * bands.level) +
      0.55 * bands.bass * gaussian(f, 0.14, 0.1) +
      0.4 * bands.mid * gaussian(f, 0.48, 0.14) +
      0.35 * bands.treble * gaussian(f, 0.8, 0.12);
    spectrum[texel] = Math.round(Math.min(1, energy) * 255);
  }
};

export const fillStudioWaveform = (
  bands: IBands,
  seconds: number,
  waveform: Uint8Array,
) => {
  for (let sample = 0; sample < WAVEFORM_TEXELS; sample += 1) {
    const t = sample / (WAVEFORM_TEXELS - 1);
    const swing =
      0.5 + 0.5 * Math.sin(t * 18 + seconds * 6) * Math.sin(t * 3.1 + seconds);
    waveform[sample] = Math.round(Math.min(1, bands.level * swing) * 255);
  }
};

export interface IStudioSignalBuffers {
  spectrum: Uint8Array;
  waveform: Uint8Array;
  /** The music with one part left in, measured as the graph measures music. */
  solo: {
    signal?: TSoloSignal;
    energy: IEnergyState;
    /** The scene clock at the last frame, for frames without their own step. */
    lastSeconds?: number;
    /** One per spectrum texel, at the texel's own frequency. */
    points: ISpectrumPoint[];
  };
}

/**
 * The frequency of each texel. The spectrum is the analyser's log-spaced
 * points stretched evenly across the texels (`fillSpectrumTexels`), so a
 * texel's place is its place on that same log scale.
 */
const texelHertz = (texel: number) =>
  MIN_FREQUENCY *
  (MAX_FREQUENCY / MIN_FREQUENCY) ** (texel / (SPECTRUM_TEXELS - 1));

export const createStudioSignalBuffers = (): IStudioSignalBuffers => ({
  spectrum: new Uint8Array(SPECTRUM_TEXELS),
  waveform: new Uint8Array(WAVEFORM_TEXELS),
  solo: {
    energy: createEnergyState(),
    points: Array.from({ length: SPECTRUM_TEXELS }, (_, texel) => ({
      x: texelHertz(texel),
      y: MIN_GAIN,
    })),
  },
});

/**
 * The live frame with only `signal`'s part of the music left in.
 *
 * Measured again rather than masked: the spectrum outside the part is taken
 * to silence and the result goes through the same measurement the graph uses
 * for music (`advanceEnergy`), so the level is as loud as that part alone is,
 * and a beat is one that part makes. The bass meter under Bass is therefore
 * the bass meter under Your music, kick for kick.
 *
 * The waveform is a picture of the whole signal and cannot have a part taken
 * out of it here, so it is scaled down by how much of the level is left.
 */
const soloFrame = (
  frame: ISceneFrame,
  signal: TSoloSignal,
  buffers: IStudioSignalBuffers,
): ISceneFrame => {
  const { solo } = buffers;
  if (solo.signal !== signal) {
    solo.signal = signal;
    solo.energy = createEnergyState();
  }
  const [from, to] = SOLO_HZ[signal];
  const depth = MAX_GAIN - MIN_GAIN;
  for (let texel = 0; texel < SPECTRUM_TEXELS; texel += 1) {
    const point = solo.points[texel];
    if (point) {
      const inside = point.x >= from && point.x < to;
      const heard = inside ? (frame.spectrum[texel] ?? 0) : 0;
      point.y = MIN_GAIN + (heard / 255) * depth;
      buffers.spectrum[texel] = heard;
    }
  }
  // A frame that does not say how long it took is timed by the scene clock,
  // which wraps: a step back through the wrap counts as no time at all.
  const elapsedMs =
    frame.deltaMs ??
    (solo.lastSeconds === undefined
      ? 0
      : Math.max(0, (frame.timeSeconds - solo.lastSeconds) * 1000));
  solo.lastSeconds = frame.timeSeconds;
  const energy = advanceEnergy(
    solo.energy,
    solo.points,
    MIN_GAIN,
    MAX_GAIN,
    elapsedMs,
    true,
  );
  const left = frame.level > 0 ? Math.min(1, energy.level / frame.level) : 0;
  for (let sample = 0; sample < WAVEFORM_TEXELS; sample += 1) {
    buffers.waveform[sample] = Math.round((frame.waveform[sample] ?? 0) * left);
  }
  return {
    ...frame,
    level: energy.level,
    beat: energy.beat,
    bands: [energy.bass, energy.mid, energy.treble],
    spectrum: buffers.spectrum,
    waveform: buffers.waveform,
  };
};

/**
 * The frame the stage's scene hears under `signal`. Live music passes through
 * untouched; every other signal replaces the measurements and keeps the rest
 * — the clock, the fade, the theme colour, the parameters — as they were.
 */
export const shapeStudioFrame = (
  frame: ISceneFrame,
  signal: TStudioSignal,
  buffers: IStudioSignalBuffers,
): ISceneFrame => {
  if (signal === 'live') {
    return frame;
  }
  if (isSolo(signal)) {
    return soloFrame(frame, signal, buffers);
  }
  const bands = studioBands(signal, frame.timeSeconds);
  if (signal === 'showcase') {
    fillShowcaseSpectrum(bands, frame.timeSeconds, buffers.spectrum);
  } else {
    fillStudioSpectrum(bands, buffers.spectrum);
  }
  fillStudioWaveform(bands, frame.timeSeconds, buffers.waveform);
  return {
    ...frame,
    level: bands.level,
    beat: bands.beat,
    bands: [bands.bass, bands.mid, bands.treble],
    spectrum: buffers.spectrum,
    waveform: buffers.waveform,
    // Made-up music is music being played, whatever the room is doing;
    // Silence is nothing played, and rests as the graph does in silence.
    playing: signal !== 'silence',
  };
};
