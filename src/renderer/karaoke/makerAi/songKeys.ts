/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which key a sung pitch is.
 *
 * The pitch tracker says how high the voice is, to a few cents, and that was
 * never what was wrong with the notes. Measured on six songs that bring their
 * own charts (2,809 notes), the tracker's pitch named the chart's note 60% of
 * the time and a note one key away another 27%: the notes were being read off
 * a good contour badly. Three things decide which key a pitch belongs to, and
 * the contour alone settles none of them:
 *
 * - where the song's keys are. Not every recording sits at A = 440;
 * - which keys the song uses. A pitch between two keys is far more often the
 *   scale's note sung a little off than a chromatic one;
 * - which part of the note is the note. A singer slides up into a pitch and
 *   holds it; the slide is not the note.
 *
 * Together they took the 60% to 77% with the note boundaries the charts
 * give, and no model was changed to do it.
 */

const hzToMidi = (hz: number) => 69 + 12 * Math.log2(hz / 440);

/**
 * How far a recording sits from concert pitch, in semitones (-0.5 to 0.5).
 *
 * A note is a key, and which key a pitch belongs to depends on where the
 * song's keys are. Not every recording has them at A = 440: a tape that ran
 * fast, a guitar tuned by ear, a singer who sits sharp of the band. Measured
 * on a song whose voice sat 36 cents above concert pitch, rounding to the
 * concert keys named 45% of its notes as its own chart has them, and rounding
 * to the song's own keys 59% — every pitch a third of a semitone sharp is one
 * breath away from being read as the key above.
 *
 * The sung frames say where the keys are without any reference: held notes
 * pile up at one distance from the concert grid. That distance is the mean
 * direction of the frames' fractional pitch, taken round the circle of one
 * semitone. A song with no such pile-up (a rap, a glide) has no tuning to
 * read and is left at concert pitch.
 */
export const karaokeSongTuningSemitones = (
  midiTrack: Float32Array | readonly number[],
  isSung: (frame: number) => boolean,
): number => {
  let sine = 0;
  let cosine = 0;
  let frames = 0;
  for (let frame = 0; frame < midiTrack.length; frame += 1) {
    const midi = midiTrack[frame];
    if (!Number.isNaN(midi) && isSung(frame)) {
      const turn = 2 * Math.PI * (midi - Math.round(midi));
      sine += Math.sin(turn);
      cosine += Math.cos(turn);
      frames += 1;
    }
  }
  if (frames < TUNING_MINIMUM_FRAMES) {
    return 0;
  }
  const gathered = Math.hypot(sine, cosine) / frames;
  return gathered < TUNING_MINIMUM_GATHER
    ? 0
    : Math.atan2(sine, cosine) / (2 * Math.PI);
};

/** About five seconds of singing: fewer frames say nothing about a song. */
const TUNING_MINIMUM_FRAMES = 300;

/**
 * How gathered the frames must be round one point of the semitone before it
 * is called the song's tuning. Evenly spread pitch gives 0, every frame on
 * one spot 1; the six measured songs gave 0.2 to 0.3.
 */
const TUNING_MINIMUM_GATHER = 0.08;

const MAJOR_SCALE_STEPS = [0, 2, 4, 5, 7, 9, 11];

/**
 * The share of the sung time a scale has to hold before it is leaned on. Five
 * of the six measured songs sat 87-89% inside one scale and 96-100% of their
 * chart's notes were in it; the sixth changes key, sat 73% inside its best
 * scale, and leaning on that scale cost it notes.
 */
const SCALE_MINIMUM_SHARE = 0.8;

/**
 * How much a key outside the song's scale is charged per frame, in nats.
 *
 * With the emission below (0.5 nats per squared semitone) this is the lean
 * measured best: a pitch has to sit within about 0.15 of a semitone of an
 * out-of-scale key before that key is believed over the scale note beside
 * it. A sung pitch between two keys is far more often an in-scale note sung
 * a little off than a chromatic note sung a little off. Over six charted
 * songs, with the keys already on the song's tuning, it took notes named as
 * the chart has them from 70% to 77%.
 */
export const OUT_OF_SCALE_COST = 0.35;

/**
 * The seven pitch classes the song is sung in, or none when no scale holds
 * enough of it.
 */
export const karaokeSongScale = (
  midiTrack: Float32Array | readonly number[],
  isSung: (frame: number) => boolean,
): ReadonlySet<number> | undefined => {
  const time = new Array<number>(12).fill(0);
  let total = 0;
  for (let frame = 0; frame < midiTrack.length; frame += 1) {
    const midi = midiTrack[frame];
    // Only frames that are plainly on a key vote: a slide between two notes
    // is on neither.
    if (
      !Number.isNaN(midi) &&
      isSung(frame) &&
      Math.abs(midi - Math.round(midi)) < 0.3
    ) {
      time[((Math.round(midi) % 12) + 12) % 12] += 1;
      total += 1;
    }
  }
  if (total < TUNING_MINIMUM_FRAMES) {
    return undefined;
  }
  let bestRoot = 0;
  let bestTime = -1;
  for (let root = 0; root < 12; root += 1) {
    const held = MAJOR_SCALE_STEPS.reduce(
      (sum, step) => sum + time[(root + step) % 12],
      0,
    );
    if (held > bestTime) {
      bestTime = held;
      bestRoot = root;
    }
  }
  return bestTime / total >= SCALE_MINIMUM_SHARE
    ? new Set(MAJOR_SCALE_STEPS.map((step) => (bestRoot + step) % 12))
    : undefined;
};

/**
 * A song's pitch as it is sung: smoothed, on the song's own keys.
 */
export interface IKaraokeSungPitch {
  /** MIDI pitch per frame on the song's keys, NaN where there is none. */
  midi: Float32Array;
  /** 1 where the tracker is sure the frame is sung. */
  sure: Uint8Array;
  hopMs: number;
  /** How far the song's keys sit from concert pitch, in semitones. */
  tuningSemitones: number;
  /** The seven pitch classes the song is in, when one scale holds it. */
  scale?: ReadonlySet<number>;
}

export const karaokeSungPitch = (
  pitchHz: Float32Array | readonly number[],
  confidence: Float32Array | readonly number[],
  hopMs: number,
  voicedThreshold: number,
): IKaraokeSungPitch => {
  // Median-filter the pitch track (5 frames). A lone octave error or tracker
  // glitch cannot survive a median; real note changes can.
  //
  // Deliberately not widened to cover vibrato. Five frames is 80 ms and a
  // vibrato cycle is around 180 ms, so a median long enough to flatten one
  // would also round off the attack of every real note. Vibrato is absorbed
  // where it belongs, in the price the note decoder pays to leave a note.
  const frameCount = pitchHz.length;
  const midiTrack = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    midiTrack[frame] = pitchHz[frame] > 0 ? hzToMidi(pitchHz[frame]) : NaN;
  }
  const midi = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const window: number[] = [];
    for (
      let i = Math.max(0, frame - 2);
      i <= Math.min(frameCount - 1, frame + 2);
      i += 1
    ) {
      if (!Number.isNaN(midiTrack[i])) {
        window.push(midiTrack[i]);
      }
    }
    midi[frame] = window.length
      ? window.sort((a, b) => a - b)[Math.floor(window.length / 2)]
      : NaN;
  }
  // The keys and the scale are read from the frames the tracker is sure are
  // sung, and the keys are put where this song has them.
  const isSung = (frame: number) => confidence[frame] >= voicedThreshold;
  const tuningSemitones = karaokeSongTuningSemitones(midi, isSung);
  if (tuningSemitones !== 0) {
    for (let frame = 0; frame < frameCount; frame += 1) {
      midi[frame] -= tuningSemitones;
    }
  }
  const scale = karaokeSongScale(midi, isSung);
  const sure = new Uint8Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    sure[frame] = isSung(frame) ? 1 : 0;
  }
  return { midi, sure, hopMs, tuningSemitones, scale };
};

/**
 * How near an out-of-scale key a pitch has to sit before it is that key: the
 * same lean `OUT_OF_SCALE_COST` gives the note decoder, said in semitones.
 */
const OUT_OF_SCALE_REACH = 0.15;

/** The part of a note taken as the note: after the slide into it. */
const HELD_PART_FROM = 1 / 3;

/**
 * How far past a note's end its pitch is still listened to.
 *
 * A word's time marks where its consonant starts; the pitch arrives with the
 * vowel and is held into the next word's consonant. Listening 60 ms past the
 * end named the chart's note 79% of the time against 74% stopping at the
 * end, and on each of the six songs; 90 ms added one point more and reaches
 * into short notes that follow.
 */
const HELD_PART_PAST_END_MS = 60;

/** Fewer sung frames than this and the stretch names no key. */
const MINIMUM_KEY_FRAMES = 3;

/**
 * The key sung between two moments, or undefined when too little of it is
 * sung to say.
 *
 * The median of the held part: a sung note starts under (or over) its pitch
 * and arrives, and a chart writes where it arrives. Over the six charted
 * songs the last two thirds named the chart's note 66% of the time against
 * 60% for the whole note, the middle half 59%, the most-visited key 61%.
 * `untilMs` is where the next note's own held part begins, which this one
 * never listens into.
 */
export const karaokeSungKey = (
  sung: IKaraokeSungPitch,
  startMs: number,
  endMs: number,
  untilMs = Number.POSITIVE_INFINITY,
  /** How much of the stretch has to be sung before it names a key. */
  minimumSungMs = 0,
): number | undefined => {
  const values: number[] = [];
  const fromMs = startMs + (endMs - startMs) * HELD_PART_FROM;
  const toMs = Math.min(endMs + HELD_PART_PAST_END_MS, untilMs);
  for (
    let frame = Math.max(0, Math.ceil(fromMs / sung.hopMs));
    frame < sung.midi.length && frame * sung.hopMs < toMs;
    frame += 1
  ) {
    if (sung.sure[frame] && !Number.isNaN(sung.midi[frame])) {
      values.push(sung.midi[frame]);
    }
  }
  if (
    values.length <
    Math.max(MINIMUM_KEY_FRAMES, Math.ceil(minimumSungMs / sung.hopMs))
  ) {
    return undefined;
  }
  values.sort((a, b) => a - b);
  const pitch = values[Math.floor(values.length / 2)];
  const near = Math.round(pitch);
  const { scale } = sung;
  if (!scale) {
    return near;
  }
  const other = pitch >= near ? near + 1 : near - 1;
  const inScale = (key: number) => scale.has(((key % 12) + 12) % 12);
  return Math.abs(pitch - near) > OUT_OF_SCALE_REACH &&
    !inScale(near) &&
    inScale(other)
    ? other
    : near;
};

interface IKeyedNote {
  startMs: number;
  endMs: number;
  targetMidi: number;
}

/**
 * Name each note from the pitch sung under it, once the notes sit on the
 * words.
 *
 * The notes reach this point with the key of whichever candidate covered
 * them, and a candidate is cut from the contour with no knowledge of where
 * a word starts: a fast syllable inherits its neighbour's pitch. By now each
 * note has its word's time, so its own stretch of the contour can be asked
 * directly. The octave is kept — the candidates have already been through
 * the octave repair, and a key is the same key in any octave. A note with
 * too little sung under it keeps what it had. `keep` marks notes that are
 * not the detector's to rename.
 */
export const rekeyKaraokeNotes = <T extends IKeyedNote>(
  notes: readonly T[],
  sung: IKaraokeSungPitch,
  keep: (note: T) => boolean,
): T[] => {
  const ordered = [...notes].sort((a, b) => a.startMs - b.startMs);
  const untilOf = new Map<T, number>();
  ordered.forEach((note, index) => {
    const next = ordered[index + 1];
    if (next) {
      untilOf.set(
        note,
        next.startMs + (next.endMs - next.startMs) * HELD_PART_FROM,
      );
    }
  });
  return notes.map((note) => {
    if (keep(note)) {
      return note;
    }
    const key = karaokeSungKey(
      sung,
      note.startMs,
      note.endMs,
      untilOf.get(note),
    );
    return key === undefined
      ? note
      : {
          ...note,
          targetMidi: key + 12 * Math.round((note.targetMidi - key) / 12),
        };
  });
};
