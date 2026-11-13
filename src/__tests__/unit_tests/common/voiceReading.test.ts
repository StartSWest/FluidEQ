/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The voice (`voiceReading.ts`) is a voice detector (Ivan, 2026-11-13:
 * "make sure the voice channel is really a voice detector"): it hears what
 * a voice does and an instrument does not - every partial bending by the
 * same cents at once, in the middle of the mix. It used to hear "a line of
 * notes in the middle", which a held organ note is too. Made-up sounds whose
 * nature is known, each beside the one that must not pass; the figures on
 * real songs are in the module's own words.
 */

import {
  createSoundCursor,
  createSoundHops,
  HOP_MS,
  soundHistorySamples,
  type ISoundHop,
} from '../../../common/soundHops';
import {
  createVoiceState,
  followVoice,
  quietVoice,
  readVoice,
  type IVoiceState,
} from '../../../common/voiceReading';

const RATE = 48_000;
const SECONDS = 3;

/** A note of `harmonics` partials at `hz`, wavering `cents` either way, `rateHz` times a second. */
const note = (hz: number, cents: number, rateHz: number, harmonics = 14) => {
  const out = new Float32Array(RATE * SECONDS);
  let phase = 0;
  for (let n = 0; n < out.length; n += 1) {
    const bend = cents * Math.sin((2 * Math.PI * rateHz * n) / RATE);
    phase += (2 * Math.PI * hz * 2 ** (bend / 1_200)) / RATE;
    let value = 0;
    for (let harmonic = 1; harmonic <= harmonics; harmonic += 1) {
      value += Math.sin(harmonic * phase) / harmonic;
    }
    out[n] = 0.2 * value;
  }
  return out;
};

/** The sound's hops, read sixty times a second as a drawing reads them. */
const hopsOf = (
  left: Float32Array,
  right: Float32Array,
  each: (hop: ISoundHop) => void,
) => {
  const history = soundHistorySamples(RATE);
  const padded = (channel: Float32Array) => {
    const out = new Float32Array(channel.length + history);
    out.set(channel, history);
    return out;
  };
  const paddedLeft = padded(left);
  const paddedRight = padded(right);
  const hops = createSoundHops(RATE);
  const cursor = createSoundCursor();
  for (let frame = 0; (frame * RATE) / 60 <= left.length; frame += 1) {
    const end = Math.min(left.length, Math.round((frame * RATE) / 60));
    hops.update(
      paddedLeft.subarray(end, end + history),
      paddedRight.subarray(end, end + history),
      (end * 1_000) / RATE,
    );
    hops.take(cursor).forEach(each);
  }
};

/** The voice as it stands after the sound, and the widest its mouth stood open in the last half. */
const heard = (left: Float32Array, right: Float32Array) => {
  const state = createVoiceState();
  let widest = 0;
  hopsOf(left, right, (hop) => {
    followVoice(state, hop.voice, hop.stepMs);
    if (hop.atMs > (SECONDS * 1_000) / 2) {
      widest = Math.max(widest, state.open);
    }
  });
  return { state, reading: readVoice(state), widest };
};

const SILENCE = new Float32Array(RATE * SECONDS);
// A singer on A3 with a vibrato of a quarter tone either way, and one
// gliding slowly between notes with none.
const VIBRATO = note(220, 45, 5.5);
const GLIDE = note(330, 150, 0.7, 12);
// The same note held to the cent: an organ, a pad, a bass.
const ORGAN = note(220, 0, 0);

describe('what a voice does and an instrument does not', () => {
  it('is sure of a voice that wavers or glides, and opens its mouth', () => {
    [VIBRATO, GLIDE].forEach((voice) => {
      const { reading, widest } = heard(voice, voice);
      expect(reading.sure).toBeGreaterThan(0.9);
      expect(widest).toBeGreaterThan(0.8);
    });
  });

  it('hears no voice in a note held still, and keeps the mouth shut', () => {
    const { reading, widest, state } = heard(ORGAN, ORGAN);
    expect(reading.sure).toBeLessThan(0.05);
    expect(widest).toBeLessThan(0.02);
    // The control: the organ is as loud and as much in the middle as the
    // voice was - only its partials stand still.
    expect(state.traits.share).toBeGreaterThan(0.95);
    expect(state.traits.together).toBeLessThan(0.05);
  });

  it('still hears the voice over the held note', () => {
    const both = Float32Array.from(VIBRATO, (v, n) => v + 0.5 * ORGAN[n]);
    expect(heard(both, both).reading.sure).toBeGreaterThan(0.9);
  });

  it('takes the note being sung, between 80 Hz and 1 kHz', () => {
    const { reading, state } = heard(VIBRATO, VIBRATO);
    expect(Math.abs(state.pitchHz - 220)).toBeLessThan(12);
    expect(reading.pitch).toBeCloseTo(Math.log2(220 / 80) / Math.log2(12.5), 1);
  });
});

describe('where a voice is', () => {
  it('hears none in a sound that is all to one side', () => {
    // The same wavering voice, hard left: nothing of it is the middle's.
    const { reading, widest } = heard(VIBRATO, SILENCE);
    expect(reading.sure).toBeLessThan(0.05);
    expect(widest).toBeLessThan(0.02);
  });

  it('hears none in silence', () => {
    const { reading, widest } = heard(SILENCE, SILENCE);
    expect(reading.sure).toBe(0);
    expect(widest).toBe(0);
  });
});

describe('when the sound stops', () => {
  const sung = (): IVoiceState => heard(VIBRATO, VIBRATO).state;

  it('closes the mouth and loses its certainty, and keeps the note', () => {
    const state = sung();
    const { pitch } = readVoice(state);
    quietVoice(state, 1_000);
    expect(readVoice(state).open).toBeLessThan(0.01);
    expect(readVoice(state).sure).toBeLessThan(0.01);
    expect(readVoice(state).pitch).toBe(pitch);
  });
});

describe('the hops a voice is heard in', () => {
  it("say each partial's phase and how far apart the windows stand", () => {
    const tone = Float32Array.from(
      { length: RATE },
      (_, n) => 0.5 * Math.sin((2 * Math.PI * 1_000 * n) / RATE),
    );
    const advances: number[] = [];
    const heardHz: number[] = [];
    let before: Float32Array | undefined;
    hopsOf(tone, tone, (hop) => {
      const { phase, advanceMs, binHz } = hop.voice;
      if (!phase || advanceMs === undefined) {
        throw new Error('a hop read from samples carries its phase');
      }
      advances.push(advanceMs);
      const bin = Math.round(1_000 / binHz);
      if (before && advanceMs > 0 && hop.atMs > 200) {
        // The bin's own advance, and how far the tone ran ahead of it.
        const turn = 2 * Math.PI;
        let ahead =
          phase[bin] - before[bin] - (turn * bin * binHz * advanceMs) / 1_000;
        ahead -= turn * Math.round(ahead / turn);
        heardHz.push(bin * binHz + ahead / ((turn * advanceMs) / 1_000));
      }
      before = Float32Array.from(phase);
    });
    // The first hop has no window before it; every other stands a hop on.
    expect(advances[0]).toBe(0);
    expect(new Set(advances.slice(1))).toEqual(new Set([HOP_MS]));
    // And the phase says where the tone is to a fraction of a hertz, where
    // a bin is 23 Hz wide.
    heardHz.forEach((hz) => expect(Math.abs(hz - 1_000)).toBeLessThan(0.2));
    expect(heardHz.length).toBeGreaterThan(50);
  });
});
