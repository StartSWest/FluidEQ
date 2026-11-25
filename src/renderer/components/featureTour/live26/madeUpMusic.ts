/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The made-up sound 2.6's live slides are drawn against: never the
 * listener's own music, which belongs to their settings and would move a
 * picture of somebody else's. Every reading is a pure function of the time,
 * so the same second always looks the same and a still frame is a real one.
 *
 * A 120 BPM groove: a kick on every beat, a bass under it, a voice singing
 * phrases with breaths between them, and hats on the off-beats.
 */

const BEAT = 0.5;
const BAR = BEAT * 4;
const PHRASE = BAR * 2;

/** 0 to 1, a repeatable scatter for the `n`th of something. */
const scatter = (n: number) => {
  const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

const decay = (since: number, seconds: number) =>
  since < 0 ? 0 : Math.exp(-since / seconds);

/** How far into the current beat, the current 8th, the current phrase. */
const into = (seconds: number, length: number) => seconds % length;

/**
 * Whether a voice is singing at `seconds`, and how strongly, 0 to 1: three
 * bars of words in each phrase of four, syllables rising and falling, a
 * breath between phrases.
 */
export const voiceAt = (seconds: number): number => {
  const inPhrase = into(seconds, PHRASE);
  if (inPhrase > PHRASE - 0.9) {
    return 0;
  }
  const syllable = Math.floor(seconds / 0.22);
  const shape = Math.sin((into(seconds, 0.22) / 0.22) * Math.PI);
  const loud = 0.55 + 0.45 * scatter(syllable);
  // A short gap now and then between words.
  return scatter(syllable * 7 + 3) < 0.18 ? 0.08 * shape : shape * loud;
};

/**
 * Each band's level as the Dynamics stage hears it, dBFS: lows below
 * 150 Hz, the middle to 4 kHz, the highs above.
 */
export const bandLevelsAt = (
  seconds: number,
): readonly [number, number, number] => {
  const sinceKick = into(seconds, BEAT);
  const bar = Math.floor(seconds / BAR);
  // The last bar of four lets the kick drop out, so the lows fall quiet
  // and the lift has something to do.
  const kickOn = bar % 4 !== 3;
  const lows =
    -44 +
    (kickOn ? 30 * decay(sinceKick, 0.16) : 0) +
    6 * Math.sin(seconds * 1.7);
  const middle = -48 + 30 * voiceAt(seconds) + 4 * Math.sin(seconds * 0.9);
  const sinceHat = into(seconds + BEAT / 2, BEAT);
  const highs = -50 + 22 * decay(sinceHat, 0.07) + 8 * voiceAt(seconds) ** 2;
  return [lows, middle, highs];
};

/**
 * A voice reaching a microphone and what is left of it after the rack, as
 * linear peaks 0 to 1: the room's hum under everything, which the cleaner
 * takes out, and the voice brought to a steady level.
 */
export const micLevelsAt = (
  seconds: number,
): { input: number; output: number } => {
  const voice = voiceAt(seconds * 0.85);
  const room = 0.012 + 0.006 * scatter(Math.floor(seconds * 30));
  const input = Math.min(
    1,
    room + voice * (0.18 + 0.2 * scatter(Math.floor(seconds * 2))),
  );
  const output = voice > 0.1 ? Math.min(1, 0.05 + voice * 0.32) : 0.0012;
  return { input, output };
};
