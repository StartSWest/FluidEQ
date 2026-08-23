/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Tuned strings that the music plucks.
 *
 * WHY THIS EXISTS AND THE EXCITER DOES NOT ANSWER IT. A harmonic generator can
 * only ever colour what is already playing: it multiplies the signal against
 * itself, so everything it makes is locked to the input's own frequencies and
 * arrives at the same instant. Soloed, that is fizz — and on a band more than
 * an octave wide it is not even harmonics, because a non-linearity fed hundreds
 * of partials produces the sum and difference of every pair. Intermodulation
 * hash. That is a fact about non-linearities rather than a fault in one, and no
 * amount of tuning a curve escapes it.
 *
 * A resonator is the opposite kind of thing. It is a delay fed back on itself,
 * so it RINGS at a pitch of its own choosing, and the music only excites it.
 * What comes out sustains after the note that started it, sits at a frequency
 * the player chose, and decays like a struck string. Soloed it is a pitched,
 * breathing layer that follows the music's rhythm — something to listen to,
 * rather than something to bury.
 *
 * This is the Karplus-Strong string, which is the oldest and still the best
 * trick in physical modelling: a delay line, a feedback gain, and one lowpass
 * inside the loop. The lowpass is what makes it a string rather than a buzzer —
 * each trip round the loop loses more treble than bass, so the tone starts
 * bright and darkens as it decays, which is what every real plucked or struck
 * thing does.
 */

/**
 * The intervals the voices are tuned to, as ratios of the root.
 *
 * A root, a fifth and an octave: the three notes that belong to every key at
 * once. A third would sound better against a major track and actively wrong
 * against a minor one, and this has no idea which it is playing over — so the
 * chord is deliberately the one with no third in it, which is why power chords
 * work over anything.
 *
 * The fifth is 1.4983 rather than 1.5. Equal temperament's fifth is seven
 * semitones, 2^(7/12), and a just 1.5 beats against a recording tuned the
 * ordinary way at about one cycle a second — slow enough to hear as wobble
 * rather than as chorus.
 */
const INTERVALS = [1, 2 ** (7 / 12), 2] as const;

/**
 * How far each voice is detuned from its neighbour, in cents.
 *
 * Not zero. Three exactly-tuned delays ring as one voice with a comb response;
 * a few cents apart they beat slowly against each other and the result reads as
 * an ensemble rather than as a filter. This is the same reason a twelve-string
 * sounds bigger than a six.
 */
const SPREAD_CENTS = 6;

/** Feedback at the extremes of the decay dial, per round trip. */
const MIN_FEEDBACK = 0.72;
const MAX_FEEDBACK = 0.998;

/**
 * The damping filter's coefficient at the extremes of the tone dial.
 *
 * At 0 the loop loses most of its treble every pass and the voice is a soft
 * marimba; at 1 it keeps nearly all of it and rings like a bowed string. Below
 * about 0.15 the loop is so dark that only the fundamental survives and the
 * decay stops sounding plucked.
 */
const MIN_DAMPING = 0.15;
const MAX_DAMPING = 0.92;

/** Longest delay any voice needs, at the lowest tuning this offers. */
const MIN_TUNE_HZ = 40;

interface IVoiceState {
  buffer: Float32Array;
  cursor: number;
  /** Fractional read distance, so a voice can be tuned between samples. */
  delay: number;
  /** The one-pole lowpass inside the loop. @see MIN_DAMPING */
  lowpass: number;
}

export interface IResonatorState {
  voices: IVoiceState[];
  /** Removes the DC a long feedback loop can accumulate. */
  dcX: number;
  dcY: number;
}

const createVoice = (sampleRate: number): IVoiceState => ({
  // Sized for the lowest note this can be tuned to, plus a sample of slack for
  // the interpolator to read behind. Allocated once, never grown: this runs in
  // an audio callback.
  buffer: new Float32Array(Math.ceil(sampleRate / MIN_TUNE_HZ) + 4),
  cursor: 0,
  delay: 100,
  lowpass: 0,
});

export const createResonator = (sampleRate: number): IResonatorState => ({
  voices: INTERVALS.map(() => createVoice(sampleRate)),
  dcX: 0,
  dcY: 0,
});

/**
 * Run one block, replacing it with what the strings are ringing.
 *
 * The input EXCITES rather than passes through: what comes back is the loops'
 * own output, so the caller mixes it in as a layer rather than as a processed
 * copy. That is the whole difference from every other stage in this rack.
 *
 * @param tuneHz The root the voices are tuned to.
 * @param decay 0-1, how long they ring.
 * @param tone 0-1, how bright the ring stays as it decays.
 */
export const resonatorBlock = (
  state: IResonatorState,
  target: Float32Array,
  tuneHz: number,
  decay: number,
  tone: number,
  sampleRate: number,
): void => {
  const feedback = MIN_FEEDBACK + (MAX_FEEDBACK - MIN_FEEDBACK) * decay;
  const damping = MIN_DAMPING + (MAX_DAMPING - MIN_DAMPING) * tone;
  const root = Math.max(MIN_TUNE_HZ, tuneHz);

  state.voices.forEach((voice, index) => {
    const detune = 2 ** ((SPREAD_CENTS * (index - 1)) / 1_200);
    const hz = root * INTERVALS[index] * detune;
    const wanted = sampleRate / hz;
    // Clamped inside the buffer with room for the interpolator's two taps.
    voice.delay = Math.min(voice.buffer.length - 3, Math.max(2, wanted));
  });

  for (let i = 0; i < target.length; i += 1) {
    const input = target[i];
    let sum = 0;

    for (let v = 0; v < state.voices.length; v += 1) {
      const voice = state.voices[v];
      const size = voice.buffer.length;

      /**
       * A FRACTIONAL read, because a whole-sample delay cannot be in tune.
       *
       * At 48 kHz a delay of 109 samples is 440.4 Hz and 110 is 436.4 — four
       * hertz apart, which is most of a semitone in the wrong direction. A
       * resonator that can only land on those steps is out of tune with the
       * record it is ringing over, which is the one thing this must never be.
       * Linear interpolation between the two neighbours costs an add and a
       * multiply and puts it exactly where it was asked for.
       */
      const back = voice.cursor - voice.delay + size;
      const whole = Math.floor(back);
      const fraction = back - whole;
      const a = voice.buffer[whole % size];
      const b = voice.buffer[(whole + 1) % size];
      const delayed = a + (b - a) * fraction;

      // The damping lowpass, INSIDE the loop, which is what makes it a string:
      // every trip round loses more treble than bass, so the voice starts
      // bright and darkens as it decays.
      voice.lowpass = delayed * damping + voice.lowpass * (1 - damping);

      voice.buffer[voice.cursor] = input + voice.lowpass * feedback;
      voice.cursor = (voice.cursor + 1) % size;
      sum += voice.lowpass;
    }

    // A loop with feedback this close to unity will accumulate any offset its
    // input carries until it saturates, so the sum is DC blocked on the way
    // out. 0.999 is a corner near 8 Hz at 48 kHz — below the lowest voice.
    const mixed = sum / state.voices.length;
    const y = mixed - state.dcX + 0.999 * state.dcY;
    state.dcX = mixed;
    state.dcY = y;
    // Soft-limited rather than left to run away: at the top of the decay dial
    // a sustained note can drive a loop above unity, and a resonator that can
    // explode is one that will.
    target[i] = Math.tanh(y);
  }
};
