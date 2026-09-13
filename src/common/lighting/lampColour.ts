/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { getEaseFactor } from '../smoothing';
import {
  DEFAULT_DEVICE_TUNING,
  type IDeviceLightingTuning,
  type TLightingIdle,
} from './lightingProfiles';
import type {
  ILamp,
  ILightingFrame,
  TLightingKind,
  TLightingPulse,
} from './lightingModel';

/**
 * From a scene's picture to the colour of every lamp on a device.
 *
 * Shared by the main process, which sends the colours, and by the page, which
 * draws the same devices lit the same way — one function, so what the page
 * shows is what the desk shows.
 *
 * Scene preserves the actual picture: dark background and bright foreground,
 * without replacing shadows with the dominant hue. The other styles borrow
 * the scene's palette and drive it with their own musical movement.
 */

const SRGB_TO_LINEAR = (() => {
  const table = new Float32Array(256);
  for (let index = 0; index < 256; index += 1) {
    const c = index / 255;
    table[index] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }
  return table;
})();

const linearToSrgb = (value: number): number => {
  const c = Math.min(1, Math.max(0, value));
  return c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
};

const luminance = (r: number, g: number, b: number): number =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * How much a cell's light counts: its brightness squared, times how coloured
 * it is. Brightness alone was not enough — measured in the harness on a neon
 * skyline, a key over a pink window, a green one and the grey haze between
 * them came out khaki, because three hues averaged are no hue. Weighting by
 * saturation lets the neon win the patch and the haze fall away.
 */
const lightWeight = (r: number, g: number, b: number): number => {
  // The brightest channel, not luminance: luminance counts green six times
  // blue, and a purple and pink scene came out green-yellow because its few
  // green windows outweighed everything else.
  const high = Math.max(r, g, b);
  const saturation = high > 1e-6 ? (high - Math.min(r, g, b)) / high : 0;
  return high * high * (0.15 + saturation * saturation) + 1e-6;
};

/**
 * LEDs carry colour better than they carry pastel: pull a normalised colour
 * (brightest channel at 1) towards its own hue by raising every channel to a
 * power, which leaves the brightest channel where it is and deepens the rest.
 */
const SATURATE = 1.7;

/**
 * Below this linear luminance a patch has no light of its own. Measured
 * against the Plus scenes' skies: their darkest drawn blues sit around 0.002,
 * lit windows and neon above 0.05.
 */
const PRESENCE_FLOOR = 0.004;
const PRESENCE_FULL = 0.06;

const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export interface IMood {
  r: number;
  g: number;
  b: number;
  background?: { r: number; g: number; b: number; noise: number };
}

/**
 * The scene's own colour: its whole picture averaged, each cell weighted by
 * the square of its brightness so the lights in it outvote the dark between
 * them. Linear light.
 */
export const measureMood = (frame: ILightingFrame): IMood => {
  const { rgb } = frame;
  if (rgb.length === 0) {
    return { r: 0, g: 0, b: 0, background: { r: 0, g: 0, b: 0, noise: 0 } };
  }
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  const clusters = new Map<
    number,
    { count: number; r: number; g: number; b: number; squares: number }
  >();
  for (let index = 0; index < rgb.length; index += 3) {
    const lr = SRGB_TO_LINEAR[rgb[index]];
    const lg = SRGB_TO_LINEAR[rgb[index + 1]];
    const lb = SRGB_TO_LINEAR[rgb[index + 2]];
    const weight = lightWeight(lr, lg, lb);
    r += lr * weight;
    g += lg * weight;
    b += lb * weight;
    total += weight;
    // A narrow colour family finds light backdrops too, without counting a
    // distinct foreground in the same broad bucket as background noise.
    const bin =
      Math.floor(rgb[index] / 8) * 1024 +
      Math.floor(rgb[index + 1] / 8) * 32 +
      Math.floor(rgb[index + 2] / 8);
    const cluster = clusters.get(bin) ?? {
      count: 0,
      r: 0,
      g: 0,
      b: 0,
      squares: 0,
    };
    cluster.count += 1;
    cluster.r += lr;
    cluster.g += lg;
    cluster.b += lb;
    cluster.squares += lr * lr + lg * lg + lb * lb;
    clusters.set(bin, cluster);
  }
  const mood = { r: r / total, g: g / total, b: b / total };
  const dominant = [...clusters.values()].reduce((best, cluster) =>
    cluster.count > best.count ? cluster : best,
  );
  const background = {
    r: dominant.r / dominant.count,
    g: dominant.g / dominant.count,
    b: dominant.b / dominant.count,
    noise: 0,
  };
  background.noise = Math.sqrt(
    Math.max(
      0,
      dominant.squares / dominant.count -
        background.r ** 2 -
        background.g ** 2 -
        background.b ** 2,
    ),
  );
  return { ...mood, background };
};

interface ISample {
  r: number;
  g: number;
  b: number;
  /** Linear luminance of the patch, before any weighting by brightness. */
  y: number;
}

/**
 * The patch around one lamp, brightness-weighted, in linear light. Written
 * into `into` rather than returned: a keyboard is a hundred and thirty lamps,
 * thirty times a second.
 */
const sampleLamp = (
  frame: ILightingFrame,
  lamp: ILamp,
  into: ISample,
  faithful = false,
): ISample => {
  const { width, height, rgb } = frame;
  // Square cells: the grid keeps the picture's aspect, so one radius in
  // cells covers a round patch of the scene.
  const radius = Math.max(0.6, lamp.reach * width);
  const cx = lamp.u * width - 0.5;
  const cy = lamp.v * height - 0.5;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  const sigma2 = 2 * (radius * 0.7) ** 2;
  let r = 0;
  let g = 0;
  let b = 0;
  let total = 0;
  let plainY = 0;
  let plainTotal = 0;
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const distance2 = (x - cx) ** 2 + (y - cy) ** 2;
      const falloff = Math.exp(-distance2 / sigma2);
      const at = (y * width + x) * 3;
      const lr = SRGB_TO_LINEAR[rgb[at]];
      const lg = SRGB_TO_LINEAR[rgb[at + 1]];
      const lb = SRGB_TO_LINEAR[rgb[at + 2]];
      const cellY = luminance(lr, lg, lb);
      const weight = faithful ? falloff : falloff * lightWeight(lr, lg, lb);
      r += lr * weight;
      g += lg * weight;
      b += lb * weight;
      total += weight;
      plainY += cellY * falloff;
      plainTotal += falloff;
    }
  }
  into.r = r / total;
  into.g = g / total;
  into.b = b / total;
  into.y = plainTotal > 0 ? plainY / plainTotal : 0;
  return into;
};

/**
 * Which part of the music drives a kind of device hardest.
 *
 * A keyboard or a mouse has enough lamps to show the picture itself, so the
 * picture leads and the overall level breathes under it. A headset, a stand
 * or a speaker is one or two glows: there the bass is what moves, the way a
 * sub is felt rather than seen.
 */
const DRIVE_BY_KIND: Record<
  TLightingKind,
  { level: number; bass: number; mid: number; treble: number }
> = {
  keyboard: { level: 0.6, bass: 0.1, mid: 0.2, treble: 0.1 },
  mouse: { level: 0.4, bass: 0.1, mid: 0.2, treble: 0.3 },
  keypad: { level: 0.5, bass: 0.1, mid: 0.3, treble: 0.1 },
  mousepad: { level: 0.3, bass: 0.6, mid: 0.1, treble: 0 },
  headset: { level: 0.3, bass: 0.6, mid: 0.1, treble: 0 },
  stand: { level: 0.3, bass: 0.7, mid: 0, treble: 0 },
  speaker: { level: 0.2, bass: 0.8, mid: 0, treble: 0 },
  accessory: { level: 0.4, bass: 0.5, mid: 0.1, treble: 0 },
};

const PULSE_DEPTH: Record<TLightingPulse, number> = {
  off: 0,
  gentle: 0.14,
  full: 0.34,
};

/**
 * Lowest a lit lamp goes. Music never takes a lamp to black between beats:
 * going dark and bright again several times a second is a flash, and a desk
 * of them in the corner of the eye is the kind that hurts.
 */
const INTENSITY_FLOOR = 0.55;

/**
 * At most three beat kicks a second. WCAG 2.3.1 draws the line for general
 * flashes at three per second; a beat detector holding for 200 ms would allow
 * five, and fast drum and bass at full pulse would reach them.
 */
const MIN_KICK_GAP_MS = 334;

const ATTACK_HALF_LIFE_MS = 28;
const RELEASE_HALF_LIFE_MS = 150;
const KICK_RELEASE_HALF_LIFE_MS = 110;

/** One device's lamps between frames. */
export interface ILampMemory {
  seconds: number;
  /** sRGB 0..255 as floats, three per lamp: what was last sent. */
  current: Float32Array;
  kick: number;
  sinceKickMs: number;
  previousBeat: number;
  primed: boolean;
}

export const createLampMemory = (lampCount: number): ILampMemory => ({
  seconds: 0,
  current: new Float32Array(lampCount * 3),
  kick: 0,
  sinceKickMs: MIN_KICK_GAP_MS,
  previousBeat: 0,
  primed: false,
});

export interface ILampShaping {
  kind: TLightingKind;
  brightness: number;
  pulse: TLightingPulse;
  tuning?: IDeviceLightingTuning;
  idleBrightness?: number;
  idle?: TLightingIdle;
}

/**
 * Advance one device by one frame and write its lamps into `out` as sRGB
 * bytes, three per lamp. `mood` is `measureMood(frame)`, computed once per
 * frame for every device.
 */
export const lightLamps = (
  frame: ILightingFrame,
  mood: IMood,
  lamps: readonly ILamp[],
  shaping: ILampShaping,
  memory: ILampMemory,
  out: Uint8Array,
): void => {
  const drive = DRIVE_BY_KIND[shaping.kind];
  const tuning = shaping.tuning ?? DEFAULT_DEVICE_TUNING;
  memory.seconds += frame.deltaMs / 1000;
  const time = frame.timeSeconds ?? memory.seconds;
  const activity = frame.activity ?? 1;
  const focused = tuning.focus === 'balanced' ? undefined : frame[tuning.focus];
  const music = Math.min(
    1,
    tuning.sensitivity *
      (focused ??
        drive.level * frame.level +
          drive.bass * frame.bass +
          drive.mid * frame.mid +
          drive.treble * frame.treble),
  );

  // A kick starts on a rising beat, and only when the last one is far
  // enough behind: counted in audio time, frame by frame.
  memory.sinceKickMs += frame.deltaMs;
  const rising = frame.beat > 0.6 && memory.previousBeat <= 0.6;
  memory.previousBeat = frame.beat;
  if (rising && memory.sinceKickMs >= MIN_KICK_GAP_MS) {
    memory.kick = 1;
    memory.sinceKickMs = 0;
  } else {
    memory.kick *= 1 - getEaseFactor(frame.deltaMs, KICK_RELEASE_HALF_LIFE_MS);
  }
  const kick = PULSE_DEPTH[shaping.pulse] * memory.kick;

  const moodPeak = Math.max(mood.r, mood.g, mood.b, 1e-6);
  const attack = getEaseFactor(
    frame.deltaMs,
    ATTACK_HALF_LIFE_MS * (0.35 + tuning.smoothing * 1.3),
  );
  const release = getEaseFactor(
    frame.deltaMs,
    RELEASE_HALF_LIFE_MS * (0.35 + tuning.smoothing * 1.3),
  );
  const { primed } = memory;
  const ease = (at: number, target: number) => {
    const previous = memory.current[at];
    const next = primed
      ? previous + (target - previous) * (target > previous ? attack : release)
      : target;
    memory.current[at] = next;
    out[at] = Math.round(Math.min(255, Math.max(0, next)));
  };

  const sample: ISample = { r: 0, g: 0, b: 0, y: 0 };
  const travellingSample: ISample = { r: 0, g: 0, b: 0, y: 0 };
  // One backdrop colour for the entire device. Raising it must not amplify
  // the picture's vignette, shadows and bokeh into patchy background keys.
  const background = mood.background ?? { r: 0, g: 0, b: 0, noise: 0 };
  const contrast = Math.max(
    Math.abs(mood.r - background.r),
    Math.abs(mood.g - background.g),
    Math.abs(mood.b - background.b),
    0.015,
  );
  const backgroundEdge = Math.max(background.noise * 2, contrast * 0.04, 1e-5);
  const backgroundNeutral = luminance(background.r, background.g, background.b);
  const back = [background.r, background.g, background.b].map((colour) =>
    linearToSrgb(
      backgroundNeutral + (colour - backgroundNeutral) * tuning.saturation,
    ),
  );
  const backGain = Math.min(
    tuning.backgroundBrightness,
    1 / Math.max(...back, 1e-6),
  );
  lamps.forEach((lamp, index) => {
    const direction = tuning.reverse ? -1 : 1;
    const position = shaping.kind === 'mouse' ? lamp.v : lamp.u;
    const phase =
      time * tuning.speed * direction * 0.7 -
      position * Math.PI * 2 * (0.25 + tuning.spread);
    const faithful = tuning.effect === 'scene';
    const travelMix = faithful
      ? 0
      : (tuning.effect === 'flow' ? activity : 0) +
        (shaping.idle === 'flow' ? 1 - activity : 0);
    const drift = time * tuning.speed * direction * 0.055;
    const shifted = (((lamp.u + drift) % 1) + 1) % 1;
    const sceneLamp = faithful
      ? {
          ...lamp,
          u: Math.min(
            1,
            Math.max(
              0,
              (lamp.u - 0.5 - tuning.sceneOffsetX) / tuning.sceneScale + 0.5,
            ),
          ),
          v: Math.min(
            1,
            Math.max(
              0,
              (lamp.v - 0.5 - tuning.sceneOffsetY) / tuning.sceneScale + 0.5,
            ),
          ),
          reach: lamp.reach / tuning.sceneScale,
        }
      : lamp;
    sampleLamp(frame, sceneLamp, sample, faithful);
    if (travelMix > 0) {
      sampleLamp(frame, { ...lamp, u: shifted }, travellingSample);
      // Crossfade two stable samples. Scaling accumulated phase by activity
      // would race through many colour cycles when a long song stops.
      sample.r += (travellingSample.r - sample.r) * travelMix;
      sample.g += (travellingSample.g - sample.g) * travelMix;
      sample.b += (travellingSample.b - sample.b) * travelMix;
      sample.y += (travellingSample.y - sample.y) * travelMix;
    }
    if (faithful) {
      // The scene already responds to the music and keeps moving while idle.
      // Its foreground keeps that movement above a uniform scene-coloured base.
      const idlePulse =
        shaping.idle === 'breathe'
          ? 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(time * 0.55))
          : 1;
      const strength =
        shaping.brightness *
        tuning.brightness *
        (activity +
          (1 - activity) * (shaping.idleBrightness ?? 0.38) * idlePulse);
      const neutral = luminance(sample.r, sample.g, sample.b);
      // Keep the actual foreground colours; only the background is flattened.
      const shadow =
        1 -
        smoothstep(
          backgroundEdge,
          Math.max(backgroundEdge + 0.01, contrast * 0.45),
          Math.max(
            Math.abs(sample.r - background.r),
            Math.abs(sample.g - background.g),
            Math.abs(sample.b - background.b),
          ),
        );
      const red = linearToSrgb(
        neutral + (sample.r - neutral) * tuning.saturation,
      );
      const green = linearToSrgb(
        neutral + (sample.g - neutral) * tuning.saturation,
      );
      const blue = linearToSrgb(
        neutral + (sample.b - neutral) * tuning.saturation,
      );
      // Boost all three channels together. Clipping each separately would
      // turn a vivid petal pale when the foreground reaches the LED ceiling.
      const gain = Math.min(
        tuning.foregroundBrightness,
        1 / Math.max(red, green, blue, 1e-6),
      );
      const at = index * 3;
      ease(
        at,
        (back[0] * backGain * shadow + red * gain * (1 - shadow)) *
          255 *
          strength,
      );
      ease(
        at + 1,
        (back[1] * backGain * shadow + green * gain * (1 - shadow)) *
          255 *
          strength,
      );
      ease(
        at + 2,
        (back[2] * backGain * shadow + blue * gain * (1 - shadow)) *
          255 *
          strength,
      );
      return;
    }
    const presence = smoothstep(PRESENCE_FLOOR, PRESENCE_FULL, sample.y);
    const samplePeak = Math.max(sample.r, sample.g, sample.b, 1e-6);
    // Hue and saturation only, normalised to full strength: from the patch
    // where it has light, from the scene where it does not.
    const r =
      (sample.r / samplePeak) * presence + (mood.r / moodPeak) * (1 - presence);
    const g =
      (sample.g / samplePeak) * presence + (mood.g / moodPeak) * (1 - presence);
    const b =
      (sample.b / samplePeak) * presence + (mood.b / moodPeak) * (1 - presence);
    const peak = Math.max(r, g, b, 1e-6);

    // The picture's own light and dark, kept: a bright window is a brighter
    // key than the sky beside it, so the skyline is still a skyline.
    const structure = 0.72 + 0.28 * linearToSrgb(sample.y * 4);
    const wave = 0.5 + 0.5 * Math.sin(phase);
    const bandPosition = (tuning.reverse ? 1 - position : position) * 2;
    const bands = [frame.bass, frame.mid, frame.treble];
    const firstBand = Math.min(1, Math.floor(bandPosition));
    const band =
      bands[firstBand] +
      (bands[firstBand + 1] - bands[firstBand]) * (bandPosition - firstBand);
    const meter = smoothstep(
      1 - lamp.v - 0.2,
      1 - lamp.v + 0.2,
      Math.min(1, band * tuning.sensitivity),
    );
    const ripple = Math.exp(
      -((Math.abs(position - 0.5) - memory.sinceKickMs * 0.0015) ** 2) /
        (0.006 + tuning.spread * 0.07),
    );
    let movement = 0.9 + wave * music * tuning.spread * 0.1;
    if (tuning.effect === 'flow') {
      movement = 0.65 + wave * 0.35;
    } else if (tuning.effect === 'spectrum') {
      movement = 0.2 + meter * 0.8;
    } else if (tuning.effect === 'pulse') {
      movement = 0.45 + ripple * memory.kick * 0.55;
    }
    const liveIntensity =
      (structure * (INTENSITY_FLOOR + (1 - INTENSITY_FLOOR) * music) + kick) *
      movement;
    let idleWave = 0.7 + wave * 0.3;
    if (shaping.idle === 'hold') {
      idleWave = 1;
    } else if (shaping.idle === 'breathe') {
      idleWave = 0.65 + 0.35 * (0.5 + 0.5 * Math.sin(time * 0.55));
    }
    const intensity = Math.min(
      1,
      shaping.brightness *
        tuning.brightness *
        (activity * liveIntensity +
          (1 - activity) * (shaping.idleBrightness ?? 0.38) * idleWave),
    );

    // Colour encoded for the eye, strength applied to the duty cycle: an LED's
    // 0..255 is the fraction of time it is on, so the music's rise and fall
    // lands at the depth it was measured at instead of being flattened by the
    // encoding.
    const at = index * 3;
    const saturation = SATURATE * tuning.saturation;
    ease(at, linearToSrgb((r / peak) ** saturation) * 255 * intensity);
    ease(at + 1, linearToSrgb((g / peak) ** saturation) * 255 * intensity);
    ease(at + 2, linearToSrgb((b / peak) ** saturation) * 255 * intensity);
  });
  memory.primed = true;
};
