/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Something for the live graph to draw: two bars of music made here, note by
 * note — a kick, a bass line, four chords, a snare and hats — and handed to
 * the window as what Windows' loopback capture would hand it. Nobody's
 * recording, so nobody's music is in a picture, and the same two bars every
 * run.
 */

const RATE = 48000;
const BEAT = 0.5;
const BARS = 2;
const LENGTH = BEAT * 4 * BARS;

/** A minor, F, C, G — one chord a beat-pair, bass on each root. */
const CHORDS: readonly (readonly number[])[] = [
  [220, 261.63, 329.63],
  [174.61, 220, 261.63],
  [261.63, 329.63, 392],
  [196, 246.94, 293.66],
];

const noise = (context: BaseAudioContext): AudioBuffer => {
  const buffer = context.createBuffer(1, RATE, RATE);
  const samples = buffer.getChannelData(0);
  // A fixed sequence, so every run draws the same graph.
  let seed = 22222;
  for (let at = 0; at < samples.length; at += 1) {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    samples[at] = seed / 1073741824 - 1;
  }
  return buffer;
};

const envelope = (
  gain: GainNode,
  start: number,
  peak: number,
  decay: number,
) => {
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + decay);
};

const kick = (context: BaseAudioContext, at: number) => {
  const tone = context.createOscillator();
  const level = context.createGain();
  tone.frequency.setValueAtTime(130, at);
  tone.frequency.exponentialRampToValueAtTime(42, at + 0.18);
  envelope(level, at, 0.9, 0.42);
  tone.connect(level).connect(context.destination);
  tone.start(at);
  tone.stop(at + 0.45);
};

const hiss = (
  context: BaseAudioContext,
  source: AudioBuffer,
  at: number,
  type: BiquadFilterType,
  frequency: number,
  peak: number,
  decay: number,
) => {
  const player = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const level = context.createGain();
  player.buffer = source;
  filter.type = type;
  filter.frequency.value = frequency;
  envelope(level, at, peak, decay);
  player.connect(filter).connect(level).connect(context.destination);
  player.start(at, (at * 7919) % 0.5);
  player.stop(at + decay + 0.01);
};

const voice = (
  context: BaseAudioContext,
  frequency: number,
  at: number,
  length: number,
  cutoff: number,
  peak: number,
) => {
  const filter = context.createBiquadFilter();
  const level = context.createGain();
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  level.gain.setValueAtTime(0, at);
  level.gain.linearRampToValueAtTime(peak, at + 0.03);
  level.gain.setValueAtTime(peak, at + length - 0.05);
  level.gain.linearRampToValueAtTime(0, at + length);
  filter.connect(level).connect(context.destination);
  // Two saws a few cents apart: a chord with some width to it.
  [-6, 6].forEach((cents) => {
    const tone = context.createOscillator();
    tone.type = 'sawtooth';
    tone.frequency.value = frequency;
    tone.detune.value = cents;
    tone.connect(filter);
    tone.start(at);
    tone.stop(at + length);
  });
};

const render = (): Promise<AudioBuffer> => {
  const context = new OfflineAudioContext(2, RATE * LENGTH, RATE);
  const source = noise(context);
  for (let beat = 0; beat < 4 * BARS; beat += 1) {
    const at = beat * BEAT;
    kick(context, at);
    if (beat % 2 === 1) {
      hiss(context, source, at, 'bandpass', 1800, 0.5, 0.2);
    }
    hiss(context, source, at, 'highpass', 7500, 0.12, 0.06);
    hiss(context, source, at + BEAT / 2, 'highpass', 7500, 0.08, 0.05);
  }
  CHORDS.forEach((chord, index) => {
    const at = index * BEAT * 2;
    voice(context, chord[0] / 4, at, BEAT * 2, 320, 0.35);
    chord.forEach((note) => voice(context, note, at, BEAT * 2, 2600, 0.08));
  });
  return context.startRendering();
};

/** What `getDisplayMedia` answers: a still picture, and the two bars looped. */
const captureMusic = async (): Promise<MediaStream> => {
  const context = new AudioContext({ sampleRate: RATE });
  const player = context.createBufferSource();
  player.buffer = await render();
  player.loop = true;
  const destination = context.createMediaStreamDestination();
  // Well under full scale, as a mastered record plays: louder, and the
  // graph says it clips.
  const level = context.createGain();
  level.gain.value = 0.3;
  player.connect(level).connect(destination);
  player.start();
  await context.resume();
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;
  return new MediaStream([
    ...destination.stream.getAudioTracks(),
    ...canvas.captureStream(0).getVideoTracks(),
  ]);
};

export default captureMusic;
