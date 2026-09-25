import { MAX_GAIN, MIN_GAIN } from 'common/constants';
import { SPECTRUM_TEXELS, WAVEFORM_TEXELS } from 'common/sceneUniformContract';
import type { IRhythmSpectrum } from 'common/rhythmSpectrum';
import {
  createSoundCursor,
  RHYTHM_BAND_COUNT,
  type ISoundCursor,
  type ISoundHop,
} from 'common/soundHops';
import {
  BASS_HZ,
  MID_HZ,
  TREBLE_HZ,
  advanceEnergy,
  createEnergyState,
  hearStep,
  levelBandsOf,
  readEnergy,
  type IEnergyState,
  type ISpectrumEnergy,
  type ISpectrumPoint,
} from 'common/spectrumEnergy';
import {
  DROP_HALF_LIFE_MS,
  HAT_HALF_LIFE_MS,
  KICK_HALF_LIFE_MS,
  SILENT_RHYTHM,
  SNARE_HALF_LIFE_MS,
  type ISceneRhythm,
} from 'common/sceneRhythm';
import {
  STUDIO_TEST_BPM,
  STUDIO_TEST_BUILD_FROM_BEAT,
  STUDIO_TEST_CYCLE_BEATS,
  STUDIO_TEST_DROP_BEAT,
} from 'common/studioTestMusic';
import { VOICE_HIGH_HZ, VOICE_LOW_HZ } from 'common/voiceReading';
import type { ILiveSound } from '../graph/liveSound';
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

/** 1 at a hit `sinceS` ago, halving every `halfLifeMs`; nothing before it. */
const hit = (sinceS: number, halfLifeMs: number) =>
  sinceS < 0 ? 0 : 2 ** (-(sinceS * 1000) / halfLifeMs);

export const studioBands = (
  signal: TMadeSignal,
  seconds: number,
  tempo = STUDIO_TEST_BPM,
): IBands => {
  const period = 60 / tempo;
  const hat = pulse(seconds, period / 2, 11);
  const kick = pulse(seconds, period, 7);
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

/**
 * The made-up signals' time, drums and song, exact rather than listened for:
 * they are built on a grid, so the grid is the answer from their first frame
 * - a tracker would take seconds to find what is written down right here.
 * Every drum and drop falls away as the live tracker's do.
 *
 * The showcase is a song, over and over (`studioTestMusic.ts`): a plain bar,
 * a bar building, the drop on the next bar's first beat and a bar after it,
 * with the kick on one and three, the snare on two and four and hats on the
 * eighths. It was a kick on every beat and a snare on two and four, so the two
 * landed together and a scene's answer to either could not be told apart; and
 * it never built, and dropped once, so neither could be tried. The beat
 * signal is a kick on every beat and nothing else.
 */
export const studioRhythm = (
  signal: TMadeSignal,
  seconds: number,
  tempo = STUDIO_TEST_BPM,
): ISceneRhythm => {
  if (signal === 'silence') {
    return SILENT_RHYTHM;
  }
  if (signal === 'accent') {
    // One hard onset a period, with no pulse between: nothing to count, and
    // the onset lands as a drop would.
    const since = seconds % ACCENT_PERIOD_S;
    return {
      ...SILENT_RHYTHM,
      kick: hit(since, KICK_HALF_LIFE_MS),
      intensity: 0.35,
      drop: hit(since, DROP_HALF_LIFE_MS),
      dropSerial: (Math.floor(seconds / ACCENT_PERIOD_S) + 1) % 4096,
    };
  }
  const period = 60 / tempo;
  const beat = seconds / period;
  const counted = {
    beatPhase: beat % 1,
    barPhase: (beat % 4) / 4,
    tempo,
    confidence: 1,
    hat: hit((beat % 0.5) * period, HAT_HALF_LIFE_MS),
    running: true,
  };
  if (signal === 'beat') {
    return {
      ...counted,
      kick: hit((beat % 1) * period, KICK_HALF_LIFE_MS),
      snare: 0,
      intensity: 0.5,
      build: 0,
      drop: 0,
      dropSerial: 0,
    };
  }
  const inCycle = beat % STUDIO_TEST_CYCLE_BEATS;
  const building =
    inCycle >= STUDIO_TEST_BUILD_FROM_BEAT && inCycle < STUDIO_TEST_DROP_BEAT;
  const build = building
    ? (inCycle - STUDIO_TEST_BUILD_FROM_BEAT) /
      (STUDIO_TEST_DROP_BEAT - STUDIO_TEST_BUILD_FROM_BEAT)
    : 0;
  const drops =
    beat >= STUDIO_TEST_DROP_BEAT
      ? Math.floor((beat - STUDIO_TEST_DROP_BEAT) / STUDIO_TEST_CYCLE_BEATS) + 1
      : 0;
  const lastDrop =
    STUDIO_TEST_DROP_BEAT + (drops - 1) * STUDIO_TEST_CYCLE_BEATS;
  let intensity = 0.7;
  if (building) {
    intensity = 0.7 + 0.2 * build;
  } else if (inCycle >= STUDIO_TEST_DROP_BEAT) {
    intensity = inCycle < STUDIO_TEST_DROP_BEAT + 4 ? 1 : 0.85;
  }
  return {
    ...counted,
    kick: hit((beat % 2) * period, KICK_HALF_LIFE_MS),
    snare: beat >= 1 ? hit(((beat - 1) % 2) * period, SNARE_HALF_LIFE_MS) : 0,
    intensity,
    build,
    drop: drops > 0 ? hit((beat - lastDrop) * period, DROP_HALF_LIFE_MS) : 0,
    dropSerial: drops % 4096,
  };
};

/** No voice: closed, no note, nobody singing. */
const NO_VOICE: readonly [number, number, number] = [0, 0, 0];

/** The made-up singer's notes, a syllable each, in semitones over SUNG_ROOT_HZ. */
const MELODY = [0, 2, 4, 7, 4, 2, 5, 4];
const SUNG_ROOT_HZ = 220;

/** `hz` where `uVoice.y` puts it: 0 at VOICE_LOW_HZ, 1 at VOICE_HIGH_HZ. */
const voicePitchOf = (hz: number) =>
  Math.log2(hz / VOICE_LOW_HZ) / Math.log2(VOICE_HIGH_HZ / VOICE_LOW_HZ);

/**
 * The made-up music's singer: the showcase sings a syllable on every beat -
 * the mouth opening fast, held, closing before the next - to MELODY, and
 * rests while the song builds, holding its last note; the other signals
 * have no voice. From the clock, like everything made up here.
 */
export const studioVoice = (
  signal: TMadeSignal,
  seconds: number,
  tempo = STUDIO_TEST_BPM,
): readonly [number, number, number] => {
  if (signal !== 'showcase') {
    return NO_VOICE;
  }
  const beat = (seconds * tempo) / 60;
  const inCycle = beat % STUDIO_TEST_CYCLE_BEATS;
  const building =
    inCycle >= STUDIO_TEST_BUILD_FROM_BEAT && inCycle < STUDIO_TEST_DROP_BEAT;
  const syllable = building
    ? Math.floor(beat - (inCycle - STUDIO_TEST_BUILD_FROM_BEAT) - 1)
    : Math.floor(beat);
  const note =
    MELODY[((syllable % MELODY.length) + MELODY.length) % MELODY.length];
  const pitch = voicePitchOf(SUNG_ROOT_HZ * 2 ** (note / 12));
  if (building) {
    return [0, pitch, 0];
  }
  const phase = beat - syllable;
  let open = 0;
  if (phase < 0.08) {
    open = phase / 0.08;
  } else if (phase < 0.7) {
    open = 1 - (0.25 * (phase - 0.08)) / 0.62;
  } else {
    open = Math.max(0, 0.75 * (1 - (phase - 0.7) / 0.15));
  }
  return [open, pitch, 1];
};

/**
 * Where the made-up music stands between the speakers: nowhere in silence,
 * and elsewhere a slow sweep across and a breathing width, so a scene that
 * reads `uStereo` is seen answering it. It used to be the live music's,
 * passed through, so a scene moved with the room's stereo under Silence.
 */
export const studioStereo = (
  signal: TMadeSignal,
  seconds: number,
): readonly [number, number] =>
  signal === 'silence'
    ? [0, 0]
    : [
        0.35 * Math.sin((2 * Math.PI * seconds) / 8),
        0.35 + 0.15 * Math.sin((2 * Math.PI * seconds) / 5.5),
      ];

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
    /** Where it is in the window's sound (`liveSound.ts`). */
    cursor: ISoundCursor;
    /** A hop with the rest of the music taken out. */
    bands: number[];
    spectrum?: IRhythmSpectrum;
    /** The scene clock at the last frame, for frames without their own step. */
    lastSeconds?: number;
    /** The music's clock at the last frame, for the tempo's own time. */
    lastMusicSeconds?: number;
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
    cursor: createSoundCursor(),
    bands: new Array<number>(RHYTHM_BAND_COUNT).fill(0),
    points: Array.from({ length: SPECTRUM_TEXELS }, (_, texel) => ({
      x: texelHertz(texel),
      y: MIN_GAIN,
    })),
  },
});

/** Decibels a bin taken out of the music is set to: the hops' floor. */
const TAKEN_OUT_DB = -100;
/**
 * Where a spectrum point taken out of the music is put on the plot's gain
 * scale: 200 dB under its top, so under the rhythm bands' floor as well
 * (`spectrumEnergy.ts`). Put at the plot's bottom instead, it stood 40 dB
 * under the top, and read against the part's own level the "taken out" rest
 * of the music was a quiet part still playing: under Mids, Bass read 0.55.
 */
const TAKEN_OUT_GAIN = MAX_GAIN - 200;

/** A hop's bins with those outside `fromHz` to `toHz` taken out, in `solo`'s own arrays. */
const soloSpectrum = (
  solo: IStudioSignalBuffers['solo'],
  source: IRhythmSpectrum,
  [fromHz, toHz]: readonly [number, number],
): IRhythmSpectrum => {
  if (
    !solo.spectrum ||
    solo.spectrum.low.length !== source.low.length ||
    solo.spectrum.high.length !== source.high.length
  ) {
    solo.spectrum = {
      low: new Float32Array(source.low.length),
      lowBinHz: source.lowBinHz,
      high: new Float32Array(source.high.length),
      highBinHz: source.highBinHz,
    };
  }
  const kept = solo.spectrum;
  kept.lowBinHz = source.lowBinHz;
  kept.highBinHz = source.highBinHz;
  const keep = (from: Float32Array, to: Float32Array, binHz: number) => {
    for (let bin = 0; bin < from.length; bin += 1) {
      const hz = bin * binHz;
      to[bin] = hz >= fromHz && hz < toHz ? from[bin] : TAKEN_OUT_DB;
    }
  };
  keep(source.low, kept.low, source.lowBinHz);
  keep(source.high, kept.high, source.highBinHz);
  return kept;
};

/**
 * The window's hops with everything but `signal`'s part taken out, through
 * the solo's own measurement: the kick under Bass, the hats under Treble.
 */
const hearSolo = (
  solo: IStudioSignalBuffers['solo'],
  hops: readonly ISoundHop[],
  signal: TSoloSignal,
): ISpectrumEnergy => {
  const [first, last] = levelBandsOf(signal);
  hops.forEach((hop, index) => {
    for (let at = 0; at < solo.bands.length; at += 1) {
      solo.bands[at] = at >= first && at <= last ? (hop.bands[at] ?? 0) : 0;
    }
    hearStep(
      solo.energy,
      {
        bands: solo.bands,
        spectrum: soloSpectrum(solo, hop.spectrum, SOLO_HZ[signal]),
      },
      hop.stepMs + (index === 0 ? solo.cursor.lostMs : 0),
    );
  });
  return readEnergy(solo.energy);
};

/**
 * The live frame with only `signal`'s part of the music left in.
 *
 * Measured again rather than masked: the sound outside the part is taken to
 * silence and the result goes through the same measurement the graph uses
 * for music - the window's hops (`sound`) where there are any, the frame's
 * spectrum where there are not - so the level is as loud as that part alone
 * is, and a beat is one that part makes. The bass meter under Bass is
 * therefore the bass meter under Your music, kick for kick.
 *
 * The waveform is a picture of the whole signal and cannot have a part taken
 * out of it here, so it is scaled down by how much of the sound is left: the
 * part's share of the spectrum's power, as an amplitude. The two levels'
 * ratio did that while a level was a loudness; read against each one's own
 * loudest, a treble alone and the whole song both read 1, and the waveform
 * under Treble was the whole song's.
 */
const soloFrame = (
  frame: ISceneFrame,
  signal: TSoloSignal,
  buffers: IStudioSignalBuffers,
  sound: ILiveSound | undefined,
): ISceneFrame => {
  const { solo } = buffers;
  if (solo.signal !== signal) {
    solo.signal = signal;
    solo.energy = createEnergyState();
    solo.cursor = createSoundCursor();
  }
  const [from, to] = SOLO_HZ[signal];
  const depth = MAX_GAIN - MIN_GAIN;
  let whole = 0;
  let kept = 0;
  for (let texel = 0; texel < SPECTRUM_TEXELS; texel += 1) {
    const point = solo.points[texel];
    if (point) {
      const inside = point.x >= from && point.x < to;
      const texelValue = frame.spectrum[texel] ?? 0;
      const gain = MIN_GAIN + (texelValue / 255) * depth;
      // A texel at the plot's floor holds nothing measurable.
      const power = texelValue > 0 ? 10 ** (gain / 10) : 0;
      whole += power;
      if (inside) {
        kept += power;
      }
      point.y = inside ? gain : TAKEN_OUT_GAIN;
      buffers.spectrum[texel] = inside ? texelValue : 0;
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
  // The tempo in the music's own time, which reduced motion does not slow;
  // a step back through the clock's wrap is no time at all.
  const musicSeconds = frame.musicSeconds ?? frame.timeSeconds;
  const musicMs =
    solo.lastMusicSeconds === undefined
      ? elapsedMs
      : Math.max(0, (musicSeconds - solo.lastMusicSeconds) * 1000);
  solo.lastMusicSeconds = musicSeconds;
  const energy = sound
    ? hearSolo(solo, sound.take(solo.cursor), signal)
    : advanceEnergy(solo.energy, solo.points, MAX_GAIN, musicMs, true);
  const left = whole > 0 ? Math.sqrt(kept / whole) : 0;
  for (let sample = 0; sample < WAVEFORM_TEXELS; sample += 1) {
    buffers.waveform[sample] = Math.round((frame.waveform[sample] ?? 0) * left);
  }
  return {
    ...frame,
    level: energy.level,
    beat: energy.beat,
    // The other two parts are taken out, so they are nothing. The window's
    // bins split exactly where the parts meet; the rhythm's bands, all music
    // sent as a spectrum has, straddle those edges - 166 to 211 Hz is one
    // band, and the mids' - and under Bass the bass's top end read as mids
    // playing at their usual level.
    bands: [
      signal === 'bass' ? energy.bass : 0,
      signal === 'mid' ? energy.mid : 0,
      signal === 'treble' ? energy.treble : 0,
    ],
    spectrum: buffers.spectrum,
    waveform: buffers.waveform,
    // That part's own time and drums: the kick under Bass, the hats under
    // Treble, as the graph would hear them with the rest taken out.
    rhythm: energy.rhythm,
    // A voice sings in the mids: under Mids it is the music's, and with the
    // mids taken out there is none.
    voice: signal === 'mid' ? (frame.voice ?? NO_VOICE) : NO_VOICE,
  };
};

export interface IStudioShapeOptions {
  /** The made-up music's tempo: the member's AI may ask for another. */
  tempo?: number;
  /** The window's sound, which a part of the music on its own is heard in. */
  sound?: ILiveSound;
}

/**
 * The frame the stage's scene hears under `signal`. Live music passes through
 * untouched; every other signal replaces the measurements and keeps the rest
 * — the clock, the fade, the theme colour, the parameters — as they were.
 */
export const shapeStudioFrame = (
  frame: ISceneFrame,
  signal: TStudioSignal,
  buffers: IStudioSignalBuffers,
  { tempo = STUDIO_TEST_BPM, sound }: IStudioShapeOptions = {},
): ISceneFrame => {
  if (signal === 'live') {
    return frame;
  }
  if (isSolo(signal)) {
    return soloFrame(frame, signal, buffers, sound);
  }
  // Played on the music's own clock: reduced motion slows the scene, not
  // the music, and a beat clock on slowed time disagreed with its own tempo.
  const seconds = frame.musicSeconds ?? frame.timeSeconds;
  const bands = studioBands(signal, seconds, tempo);
  if (signal === 'showcase') {
    fillShowcaseSpectrum(bands, seconds, buffers.spectrum);
  } else {
    fillStudioSpectrum(bands, buffers.spectrum);
  }
  fillStudioWaveform(bands, seconds, buffers.waveform);
  const rhythm = studioRhythm(signal, seconds, tempo);
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
    rhythm,
    stereo: studioStereo(signal, seconds),
    voice: studioVoice(signal, seconds, tempo),
    // The accent button is the big moment itself: it used to pass the live
    // music's accent through, so the one signal named for it never gave one.
    ...(signal === 'accent'
      ? { musicAccent: [rhythm.drop, rhythm.dropSerial] as const }
      : {}),
    ...(signal === 'silence'
      ? { musicAccent: [0, frame.musicAccent[1]] as const }
      : {}),
  };
};
