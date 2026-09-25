import {
  createLevelState,
  followLevels,
  type ILevelState,
} from './energyLevels';
import {
  createPulseState,
  followPulse,
  pulseOf,
  type IPulseState,
} from './energyPulse';
import {
  advanceRhythm,
  createRhythmState,
  SILENT_RHYTHM,
  type IRhythmHeard,
  type IRhythmState,
  type ISceneRhythm,
} from './sceneRhythm';
import {
  RHYTHM_BAND_COUNT,
  RHYTHM_BANDS_HIGH_HZ,
  RHYTHM_BANDS_LOW_HZ,
  rhythmBandEdgeHz,
  type ISoundHop,
  type IVoiceSpectrum,
} from './soundHops';
import {
  createVoiceState,
  followVoice,
  quietVoice,
  readVoice,
  type IVoiceReading,
  type IVoiceState,
} from './voiceReading';

export { BASS_HZ, levelBandsOf, MID_HZ, TREBLE_HZ } from './energyLevels';
export { BEAT_FLASH_MS } from './energyPulse';

/**
 * What the music is doing, in four numbers, a pulse and a moment.
 *
 * The live frame carries a spectrum and a waveform and nothing else; every
 * scene that wanted a beat or a bass level has so far derived its own, in its
 * own file, with its own thresholds. This is that derivation once, so the GPU
 * scenes, the ambient layer, the lamps and the Studio's meters read one
 * answer to "is this a beat".
 *
 * How it used to work, and what was wrong with it, measured over sixty
 * seconds of each of five tracks through this same pipeline:
 *
 * - A beat was the broadband mean rising a twentieth of the plot's range
 *   above a decaying envelope. That fired 192 to 287 times a minute on every
 *   track, with gaps from 0.12 s to 0.6 s: two or three times a real pulse,
 *   and irregular, because a mean over 20 Hz to 16 kHz barely moves when a
 *   kick lands and moves plenty when anything else does.
 * - The four levels were means of decibels mapped on the plot's own scale, so
 *   each band used whatever part of 0..1 that band's music happens to sit in.
 *   Treble measured 0.00 to 0.21 across those tracks - 0.00 to 0.04 on one -
 *   and the overall level never passed half. A scene asking for treble got
 *   almost nothing, whatever the song.
 * - Everything was measured once a drawn frame, from the analyser's window
 *   at that moment: at 33 frames a second a third of the music fell between
 *   two windows and was never heard, and every number moved with the screen.
 *
 * So: everything is measured on the sound itself, a hundred times a second
 * whatever the screen is doing (`soundHops.ts`), once for every drawing in
 * the window, which each read the same answer at their own frame: the four
 * levels (`energyLevels.ts`), the pulse and the accent (`energyPulse.ts`),
 * the flywheel below, and the music's time and shape (`sceneRhythm.ts`).
 */

export interface ISpectrumPoint {
  /** Hertz. */
  x: number;
  /** Decibels, on the plot's gain scale. */
  y: number;
}

export interface ISpectrumEnergy {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  /** 1 at the beat, 0 once the flash is over. */
  beat: number;
  /**
   * A big moment - a drop, a chorus arriving, a crash - as an envelope that
   * rises over a few frames and falls away over a second and a half. Zero
   * most of the time; never more than one of them going at once.
   */
  accent: number;
  /** Counts up by one at each accent, for a scene that wants a fresh seed. */
  accentSerial: number;
  /**
   * A flywheel the music winds up, as a fraction of a turn: every kick and
   * every loud passage adds to how fast it is going, it coasts down when they
   * stop, and it cannot go faster than RUN_MAX_TURNS however hard the music
   * pushes. A scene that wants to be carried along by a chorus turns by
   * `uMusicRun` and gets an angle that never jumps, because this is where the
   * speed is kept between frames - a shader sees only the music of this one
   * frame, so a hit there is a nudge that fades, never a build-up.
   *
   * Kept inside one turn, so reading it as an angle is continuous.
   */
  run: number;
  /** How fast that wheel is going, in turns a second. */
  runSpeed: number;
  /**
   * The music's time and shape: tempo, a beat clock that lands on the beat,
   * the bar, the drums one by one, and the song's intensity, build and drops
   * (`sceneRhythm.ts`).
   */
  rhythm: ISceneRhythm;
  /** The singing voice: how open, which note, how sure (`voiceReading.ts`). */
  voice: IVoiceReading;
}

/**
 * The fastest the music can wind the wheel, in turns a second: a turn in
 * twelve seconds, which is a stone turning, not a stone spinning.
 */
export const RUN_MAX_TURNS = 0.085;
/** What one kick adds to its speed, in turns a second. */
export const RUN_KICK = 0.03;
/** What a loud passage adds every second it lasts. */
export const RUN_DRIVE = 0.01;
/** Seconds in which it falls to 1/e of its speed with nothing driving it. */
export const RUN_COAST_S = 6;

/*
 * Why those four numbers. The wheel settles at `drive × RUN_COAST_S`, so the
 * coast is what decides both how long winding up takes and how fast it ends
 * up going. At six seconds a chorus is most of the way there by its twelfth
 * second and a verse has visibly let it down again — the build-up is the
 * point, and the first tuning of this reached the cap in under a second from
 * a standing start, which is a switch and not a flywheel: on screen the
 * picture simply ran at one speed for the whole song.
 *
 * With the kick flash averaging about 0.18 over a bar at 120 bpm, a loud
 * passage with kicks settles just past the cap (0.093) so the loudest music
 * presses against it, a sustained passage with no drums reaches 0.06, and a
 * half-loud verse 0.036. That spread is what is actually felt.
 */

export interface IEnergyState extends ILevelState, IPulseState {
  /** The flywheel: where it stands, inside one turn, and how fast it goes. */
  run: number;
  runSpeed: number;
  /** The music's time, kept from the same sound. */
  rhythm: IRhythmState;
  /** The rhythm's last reading, for a moment with no new sound in it. */
  heard: ISceneRhythm;
  /** A step's bands, as the rhythm takes them. */
  bands: number[];
  /** The singing voice (`voiceReading.ts`). */
  voice: IVoiceState;
}

/** One step of sound, as `hearStep` takes it. */
export interface IHeardStep extends IRhythmHeard {
  /** The mid and side where a voice is; without them no voice is heard. */
  voice?: IVoiceSpectrum;
}

/**
 * Where the plot's top is taken to stand, in dBFS, for music that arrives as
 * points on the plot's own scale (`advanceEnergy`): a loud master's peak. It
 * only has to put the plot's range above the rhythm's silence (-80 dBFS);
 * everything measured from the points is relative to their loudest.
 */
const POINTS_TOP_DB = -20;

export const createEnergyState = (): IEnergyState => ({
  ...createLevelState(),
  ...createPulseState(),
  run: 0,
  runSpeed: 0,
  rhythm: createRhythmState(),
  heard: SILENT_RHYTHM,
  bands: new Array<number>(RHYTHM_BAND_COUNT).fill(0),
  voice: createVoiceState(),
});

/**
 * The wheel turned on by `elapsedMs` at `speed`, kept inside one turn so a
 * scene reading it as an angle never sees a jump. A drawing whose own time
 * runs slower (reduced motion) turns its own wheel by the speed.
 */
export const turnRun = (run: number, speed: number, elapsedMs: number) =>
  (run + speed * (Math.max(0, Math.min(200, elapsedMs)) / 1000)) % 1;

/**
 * One step of the wheel: the kick and the loudness wind it up, it coasts
 * down, and it never passes RUN_MAX_TURNS however hard the music pushes.
 *
 * This lives here rather than in a scene because a shader is given the music
 * of one frame and nothing else: a hit there can only ever be a nudge that
 * fades, never the build-up through a chorus that anyone watching expects.
 */
const coast = (
  state: IEnergyState,
  stepMs: number,
  kick: number,
  drive: number,
) => {
  const seconds = stepMs / 1000;
  const wound =
    state.runSpeed + (kick * RUN_KICK + drive * RUN_DRIVE) * seconds;
  state.runSpeed = Math.min(
    RUN_MAX_TURNS,
    wound * Math.exp(-seconds / RUN_COAST_S),
  );
  state.run = turnRun(state.run, state.runSpeed, stepMs);
};

/** The reading as it stands after the last step. */
export const readEnergy = (state: IEnergyState): ISpectrumEnergy => ({
  level: state.level,
  bass: state.bass,
  mid: state.mid,
  treble: state.treble,
  beat: pulseOf(state),
  accent: state.accent,
  accentSerial: state.accentSerial,
  run: state.run,
  runSpeed: state.runSpeed,
  rhythm: state.heard,
  voice: readVoice(state.voice),
});

/**
 * A reading held as it stands while nothing is measured - a paused song holds
 * its picture - with its clock stopped, so a drawing does not carry the beat
 * on by itself (`sceneFrameCarry.ts`).
 */
export const holdEnergy = (reading: ISpectrumEnergy): ISpectrumEnergy => ({
  ...reading,
  rhythm: { ...reading.rhythm, running: false },
});

/**
 * One step of sound: `heard` is its bands and, when there are any, its bins
 * and its voice's; `stepMs` how much of the music it stands for.
 */
export const hearStep = (
  state: IEnergyState,
  heard: IHeardStep,
  stepMs: number,
) => {
  const step = Math.max(1, Math.min(200, stepMs));
  followLevels(state, heard.bands, heard.spectrum, step);
  if (heard.voice) {
    followVoice(state.voice, heard.voice, step);
  } else {
    quietVoice(state.voice, step);
  }
  state.heard = advanceRhythm(state.rhythm, heard, stepMs, true);
  followPulse(state, state.rhythm, state.heard, state.level, step);
  // What winds the wheel: each pulse, weighted by the bass actually under it
  // so a hi-hat does not drive it, and the loudness of the passage itself,
  // which is what carries a chorus.
  coast(
    state,
    step,
    pulseOf(state) * (0.3 + 0.7 * state.bass),
    state.level * state.level,
  );
};

/**
 * The hops a listener took (`ISoundHops.take`) through the music, one step
 * each; `lostMs` is time it missed before the first of them.
 */
export const hearSound = (
  state: IEnergyState,
  hops: readonly ISoundHop[],
  lostMs = 0,
): ISpectrumEnergy => {
  hops.forEach((hop, index) => {
    for (let at = 0; at < RHYTHM_BAND_COUNT; at += 1) {
      state.bands[at] = hop.bands[at] ?? 0;
    }
    hearStep(
      state,
      { bands: state.bands, spectrum: hop.spectrum, voice: hop.voice },
      hop.stepMs + (index === 0 ? lostMs : 0),
    );
  });
  return readEnergy(state);
};

/**
 * The rhythm's bands from points on the plot's gain scale: each the mean
 * power of the points inside it, a band with none taking the nearest, with
 * the plot's top (`topGain`, where the track's peak lands) standing at
 * POINTS_TOP_DB.
 */
const bandsOfPoints = (
  points: readonly ISpectrumPoint[],
  topGain: number,
  out: number[],
) => {
  const power = new Array<number>(RHYTHM_BAND_COUNT).fill(0);
  const count = new Array<number>(RHYTHM_BAND_COUNT).fill(0);
  const span = Math.log(RHYTHM_BANDS_HIGH_HZ / RHYTHM_BANDS_LOW_HZ);
  const dbOf = (point: ISpectrumPoint) => POINTS_TOP_DB - (topGain - point.y);
  points.forEach((point) => {
    if (point.x < RHYTHM_BANDS_LOW_HZ || point.x >= RHYTHM_BANDS_HIGH_HZ) {
      return;
    }
    const at = Math.min(
      RHYTHM_BAND_COUNT - 1,
      Math.floor(
        (Math.log(point.x / RHYTHM_BANDS_LOW_HZ) / span) * RHYTHM_BAND_COUNT,
      ),
    );
    power[at] += 10 ** (dbOf(point) / 10);
    count[at] += 1;
  });
  for (let band = 0; band < RHYTHM_BAND_COUNT; band += 1) {
    let db = -100;
    if (count[band] > 0) {
      db = 10 * Math.log10(power[band] / count[band]);
    } else if (points.length > 0) {
      const centre = Math.sqrt(
        rhythmBandEdgeHz(band) * rhythmBandEdgeHz(band + 1),
      );
      let nearest = points[0];
      points.forEach((point) => {
        if (
          Math.abs(Math.log(point.x / centre)) <
          Math.abs(Math.log(nearest.x / centre))
        ) {
          nearest = point;
        }
      });
      db = dbOf(nearest);
    }
    out[band] = Math.max(0, Math.min(1, (db + 100) / 100));
  }
};

/**
 * One step from points on the plot's gain scale (`topGain` at its top, where
 * the track's peak lands), for music that arrives as a spectrum alone - sent
 * from another computer, or to a desktop background - where there are no
 * samples to read hops from. The drums are heard in the bands, which is
 * coarser than the hops' bins, and the step is the frame.
 *
 * `playing` false holds everything where it is rather than decaying to
 * silence: a paused song should hold its picture, and nothing is measured.
 */
export const advanceEnergy = (
  state: IEnergyState,
  points: readonly ISpectrumPoint[],
  topGain: number,
  elapsedMs: number,
  playing: boolean,
): ISpectrumEnergy => {
  if (!playing || points.length === 0) {
    // The music's time holds too, but it is told how long nothing played:
    // what it heard fades, and a gap long enough is the next song.
    state.heard = advanceRhythm(state.rhythm, undefined, elapsedMs, false);
    quietVoice(state.voice, elapsedMs);
    return readEnergy(state);
  }
  bandsOfPoints(points, topGain, state.bands);
  hearStep(state, { bands: state.bands }, elapsedMs);
  return readEnergy(state);
};
