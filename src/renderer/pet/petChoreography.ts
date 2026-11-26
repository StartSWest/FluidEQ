/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  type IPetCue,
  type IPetMusic,
  type IPetPose,
  SILENT_PET_MUSIC,
} from './petPose';

export {
  type IPetCue,
  type IPetMusic,
  type IPetPose,
  petMusicOf,
  REST_POSE,
  SILENT_PET_MUSIC,
} from './petPose';

/**
 * How the pet moves, worked out from the music the window already hears for
 * its scenes (`liveSound.ts`): pure, so a test can play her a song.
 *
 * She used to hear one number - the loudest sample - and sway on a 1.8 s
 * clock of her own whatever the tempo, with a dance rolled on dice once a
 * minute. Now each part of the music moves a part of her: the beat clock
 * lands her head on the beat (with it, not after it), the kick squashes her
 * body on a spring, the bar sways her a bar each way, the snare tilts her
 * and taps a paw, the hats flick her ears, the voice opens her mouth, the
 * song's intensity takes her from small nods to steps to hops, a build
 * crouches her and a drop makes her jump. In silence she gets drowsy and
 * sleeps; sound wakes her with an ear twitch.
 *
 * Everything is springs stepped by the frame's own elapsed time: nothing
 * here is a timer, and a slow frame moves her as far as a fast one would.
 */

/**
 * Silence after the meters let go before she is asleep. Drowsy comes first,
 * as soon as they let go (`hasLetGo`, about three and a half seconds after
 * a song ends).
 */
export const SLEEP_AFTER_MS = 30000;
/** How long drowsiness takes to settle in after the sound lets go. */
const DROWSY_MS = 1500;

interface ISpring {
  x: number;
  v: number;
}

const spring = (x = 0): ISpring => ({ x, v: 0 });

/** One semi-implicit step: stable at any frame rate the sub-steps allow. */
const pull = (
  s: ISpring,
  target: number,
  stiffness: number,
  damping: number,
  h: number,
  force = 0,
) => {
  const acceleration = stiffness * (target - s.x) - damping * s.v + force;
  s.v += acceleration * h;
  s.x += s.v * h;
  return acceleration;
};

const ease = (current: number, target: number, ms: number, tauMs: number) =>
  current + (target - current) * (1 - Math.exp(-ms / tauMs));

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const smoothstep = (from: number, to: number, x: number) => {
  const t = clamp01((x - from) / (to - from));
  return t * t * (3 - 2 * t);
};

/**
 * Where her head is through a beat: down on the beat itself and a little
 * already on its way there just before, so the nod lands with the music
 * rather than reacting to it.
 */
export const nodAt = (beatPhase: number) =>
  Math.exp(-((beatPhase / 0.15) ** 2)) +
  0.55 * Math.exp(-(((1 - beatPhase) / 0.09) ** 2));

/** A drum hit: its envelope jumping up since the last frame. */
const hitOf = (now: number, before: number, threshold: number) =>
  now - before > threshold ? now : 0;

/** A small deterministic generator, so a test sees the same blinks. */
const nextRandom = (state: { seed: number }) => {
  state.seed = (state.seed * 1664525 + 1013904223) % 4294967296;
  return state.seed / 4294967296;
};

export interface IPetMotion {
  seed: number;
  clockMs: number;
  silentMs: number;
  wasAsleep: boolean;
  amp: number;
  squash: ISpring;
  nod: ISpring;
  lean: ISpring;
  earLeft: ISpring;
  earRight: ISpring;
  fur: ISpring;
  mouth: ISpring;
  footLeft: ISpring;
  footRight: ISpring;
  pawLeft: ISpring;
  pawRight: ISpring;
  gazeX: ISpring;
  gazeY: ISpring;
  starPop: ISpring;
  hopY: number;
  hopV: number;
  breath: number;
  nextBlinkMs: number;
  blinkAtMs: number;
  secondBlinkAtMs: number;
  lid: number;
  wide: number;
  smile: number;
  pupil: number;
  speaker: number;
  joy: number;
  tilt: number;
  ear: number;
  foot: number;
  paw: number;
  nextGlanceMs: number;
  glanceX: number;
  glanceY: number;
  heard: IPetMusic;
}

export const createPetMotion = (seed = 31): IPetMotion => ({
  seed,
  clockMs: 0,
  silentMs: 0,
  wasAsleep: false,
  amp: 0,
  squash: spring(),
  nod: spring(),
  lean: spring(),
  earLeft: spring(),
  earRight: spring(),
  fur: spring(),
  mouth: spring(),
  footLeft: spring(),
  footRight: spring(),
  pawLeft: spring(),
  pawRight: spring(),
  gazeX: spring(),
  gazeY: spring(),
  starPop: spring(),
  hopY: 0,
  hopV: 0,
  breath: 0,
  nextBlinkMs: 1300,
  blinkAtMs: -1e9,
  secondBlinkAtMs: -1e9,
  lid: 0,
  wide: 1,
  smile: 0.42,
  pupil: 0.86,
  speaker: 0,
  joy: 0,
  tilt: 1,
  ear: 1,
  foot: 1,
  paw: 1,
  nextGlanceMs: 0,
  glanceX: 0,
  glanceY: 0,
  heard: SILENT_PET_MUSIC,
});

/** Gravity on a hop, in body radii a second squared. */
const GRAVITY = 26;
/** The longest step the springs take at once; a longer frame is cut up. */
const STEP_MS = 4;
/** A blink, closing and opening. */
const BLINK_MS = 160;

const blinkShape = (clockMs: number, atMs: number) => {
  const k = (clockMs - atMs) / BLINK_MS;
  return k >= 0 && k <= 1 ? 1 - Math.abs(k * 2 - 1) : 0;
};

/** Advance her by `elapsedMs` of `music` and say where every part of her is. */
export const stepPetMotion = (
  state: IPetMotion,
  music: IPetMusic,
  cue: IPetCue,
  elapsedMs: number,
): IPetPose => {
  const ms = Math.max(0, elapsedMs);
  state.clockMs += ms;
  const m = cue.isReducedMotion ? 0 : 1;
  state.silentMs = cue.isListening ? 0 : state.silentMs + ms;
  const isAsleep = state.silentMs > SLEEP_AFTER_MS;
  const woke = state.wasAsleep && !isAsleep;
  state.wasAsleep = isAsleep;
  const sleepiness = isAsleep
    ? 1
    : smoothstep(0, DROWSY_MS, state.silentMs) * 0.32;
  const hears = cue.hearsMusic && cue.isListening && !cue.isPaused;
  const heard = hears ? music : SILENT_PET_MUSIC;
  state.amp = ease(state.amp, hears ? 1 : 0, ms, 350);
  const a = state.amp;
  const i = heard.intensity;
  const nodAmp = a * (0.3 + 0.7 * smoothstep(0.2, 0.65, i));
  const leanAmp = a * (0.2 + 0.95 * smoothstep(0.3, 0.95, i));
  const feetOn = a * smoothstep(0.55, 0.8, i) * heard.confidence;
  const hopOn = a * smoothstep(0.82, 0.96, i) * heard.confidence;

  // The hits since the last frame, once each.
  const before = state.heard;
  const kick = hitOf(heard.kick, before.kick, 0.3);
  const snare = hitOf(heard.snare, before.snare, 0.3);
  const hat = hitOf(heard.hat, before.hat, 0.2);
  const onBeat =
    heard.confidence > 0.35 && heard.beatPhase < before.beatPhase - 0.5;
  const dropped =
    heard.dropSerial !== before.dropSerial && heard.drop > 0.5 && hears;
  state.heard = heard;
  if (m) {
    if (kick) {
      state.squash.v += 2.4 * kick * a;
      const evenBeat =
        heard.barPhase < 0.25 ||
        (heard.barPhase >= 0.5 && heard.barPhase < 0.75);
      if (hopOn > 0.3 && evenBeat && state.hopY <= 0) {
        state.hopV = 2.2 * hopOn;
      }
    }
    if (dropped) {
      state.hopV = 3.3 * a;
      state.starPop.v += 9 * a;
      state.blinkAtMs = state.clockMs;
    }
    if (snare && a > 0.05) {
      state.tilt = -state.tilt;
      state.lean.v += 0.75 * state.tilt * snare * a;
      state.paw = -state.paw;
      (state.paw > 0 ? state.pawLeft : state.pawRight).v += 3.2 * snare * a;
    }
    if (hat && a > 0.05) {
      state.ear = -state.ear;
      (state.ear > 0 ? state.earLeft : state.earRight).v +=
        state.ear * 5.5 * hat * a;
    }
    if (onBeat && feetOn > 0.25) {
      state.foot = -state.foot;
      (state.foot > 0 ? state.footLeft : state.footRight).v += 7 * feetOn;
    }
    if (woke) {
      state.earLeft.v -= 7;
      state.earRight.v += 7;
      state.squash.v -= 1.6;
      state.blinkAtMs = state.clockMs;
      state.secondBlinkAtMs = state.clockMs + 320;
    }
  }

  const nodTarget =
    m *
    nodAmp *
    (heard.confidence > 0.35 ? nodAt(heard.beatPhase) : heard.kick);
  const squashTarget =
    m *
    (0.05 * heard.bass * a + 0.07 * heard.build * a + (isAsleep ? 0.035 : 0));
  const leanTarget =
    m *
    (Math.sin(Math.PI * 2 * heard.barPhase) * 0.11 * leanAmp +
      (isAsleep ? 0.07 : 0));
  const earDroop = (cue.isListening ? -0.02 : 0.06) + sleepiness * 0.5;
  state.lid = ease(state.lid, sleepiness, ms, isAsleep ? 1400 : 600);
  state.wide = ease(
    state.wide,
    1 + 0.16 * heard.build * a + 0.08 * heard.drop * a,
    ms,
    200,
  );
  state.smile = ease(
    state.smile,
    0.42 + 0.34 * i * a + 0.3 * heard.drop * a - 0.22 * sleepiness,
    ms,
    350,
  );
  state.pupil = ease(state.pupil, 0.86 + 0.32 * heard.level * a, ms, 250);
  state.speaker = ease(state.speaker, heard.bass * a, ms, 30);
  state.joy = ease(state.joy, a > 0.5 && i > 0.85 ? 1 : 0, ms, 500);

  if (state.clockMs >= state.nextGlanceMs) {
    state.nextGlanceMs = state.clockMs + 1400 + nextRandom(state) * 3200;
    state.glanceX = (nextRandom(state) - 0.5) * 0.9;
    state.glanceY = (nextRandom(state) - 0.5) * 0.5;
  }
  // Wandering at rest, up with a high note, straight at you while paused.
  const gazeXTarget = cue.isPaused ? 0 : m * state.glanceX * (1 - a * 0.6);
  const gazeYTarget = cue.isPaused
    ? 0
    : m *
      (state.glanceY * (1 - a * 0.6) -
        (heard.voicePitch - 0.5) * 0.9 * heard.voiceSure * a);
  const mouthTarget = m * heard.voiceOpen * heard.voiceSure * a;

  const steps = Math.max(1, Math.ceil(ms / STEP_MS));
  const h = ms / steps / 1000;
  for (let step = 0; step < steps; step += 1) {
    pull(state.nod, nodTarget, 700, 46, h);
    pull(state.squash, squashTarget, 420, 15, h);
    const leanAcceleration = pull(state.lean, leanTarget, 55, 8.5, h);
    // The ears hang on her head: they swing against her lean and flop when
    // she lands.
    pull(
      state.earLeft,
      -earDroop,
      170,
      6.5,
      h,
      m * (-leanAcceleration * 0.55 - state.squash.v * 2.2),
    );
    pull(
      state.earRight,
      earDroop,
      170,
      6.5,
      h,
      m * (-leanAcceleration * 0.55 + state.squash.v * 2.2),
    );
    pull(
      state.fur,
      m * (-state.lean.v * 0.4 + state.squash.v * 0.12 - state.hopV * 0.05),
      90,
      7,
      h,
    );
    pull(state.mouth, mouthTarget, 1100, 58, h);
    pull(state.footLeft, 0, 320, 17, h);
    pull(state.footRight, 0, 320, 17, h);
    pull(state.pawLeft, 0, 380, 15, h);
    pull(state.pawRight, 0, 380, 15, h);
    pull(state.gazeX, gazeXTarget, 110, 21, h);
    pull(state.gazeY, gazeYTarget, 110, 21, h);
    pull(state.starPop, 0, 160, 9, h);
    if (state.hopY > 0 || state.hopV > 0) {
      state.hopV -= GRAVITY * h;
      state.hopY += state.hopV * h;
      if (state.hopY <= 0) {
        state.squash.v += Math.min(2.2, -state.hopV * 0.45);
        state.hopY = 0;
        state.hopV = 0;
      }
    }
  }

  state.breath += (ms / 1000) * Math.PI * 2 * (isAsleep ? 0.2 : 0.3);
  const breathAmp = m * (isAsleep ? 0.032 : 0.018) * (1 - 0.7 * a);
  const breath = Math.sin(state.breath) * breathAmp;
  if (m && !isAsleep && state.clockMs >= state.nextBlinkMs) {
    state.blinkAtMs = state.clockMs;
    state.nextBlinkMs = state.clockMs + 2200 + nextRandom(state) * 4400;
  }
  const blink = m
    ? Math.max(
        blinkShape(state.clockMs, state.blinkAtMs),
        blinkShape(state.clockMs, state.secondBlinkAtMs),
      )
    : 0;
  const down = (x: number) => Math.max(0, x);
  const music01 = (x: number) => clamp01(x) * a;

  return {
    swayX: state.lean.x * 0.32,
    lean: state.lean.x,
    hop: down(state.hopY),
    scaleX:
      (1 + state.squash.x * 0.55 + state.nod.x * 0.015) * (1 - breath * 0.45),
    scaleY: (1 - state.squash.x - state.nod.x * 0.035) * (1 + breath),
    faceX: state.gazeX.x * 0.55,
    faceY: state.nod.x + (isAsleep ? 0.35 : 0) * m,
    earLeft: state.earLeft.x,
    earRight: state.earRight.x,
    eyeWide: state.wide,
    blink,
    lid: state.lid,
    pupil: state.pupil,
    gazeX: state.gazeX.x,
    gazeY: state.gazeY.x,
    mouth: Math.min(1.2, down(state.mouth.x)),
    smile: state.smile,
    footLeft: down(state.footLeft.x),
    footRight: down(state.footRight.x),
    pawLeft: state.pawLeft.x,
    pawRight: state.pawRight.x,
    furSwing: state.fur.x,
    furBass: music01(heard.bass),
    furMid: music01(heard.mid),
    furTreble: music01(heard.treble),
    furHat: music01(heard.hat),
    speaker: state.speaker,
    starPop: state.starPop.x,
    joy: state.joy,
    isAsleep,
  };
};
