/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IAmbientElement,
  TAmbientArea,
  TAmbientMusic,
} from 'common/sceneAmbient';
import { MAX_AMBIENT_TOTAL } from 'common/sceneAmbient';
import { pictureBearing, picturePoses } from './ambientPictureMotion';

/**
 * Where every ambient element is and where it is going: plain numbers moved
 * by elapsed time, with nothing drawn and nothing read from the page, so a
 * test can play a field forward and look at it.
 *
 * Each motion is the thing it is named for at the pace of a background:
 * birds cross the window in shallow arcs and glide between beats of their
 * wings, drifting motes ride one slow wind, wandering things turn on a walk
 * of their own and stay inside their part of the window, stars stay put and
 * breathe, petals fall turning, bubbles rise, and swaying things bob where
 * they stand.
 */

export interface IAmbientMusicLevels {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  beat: number;
}

export interface IAmbientParticle {
  x: number;
  y: number;
  heading: number;
  /** Its own pace against the element's: 0.65 to 1.35. */
  pace: number;
  phase: number;
  spin: number;
  spinRate: number;
  size: number;
  colour: number;
  /** 0..1, fixed for its life: what makes it unlike the next one. */
  seed: number;
  anchorX: number;
  anchorY: number;
}

export interface IAmbientField {
  elements: IAmbientElement[];
  particles: IAmbientParticle[][];
  width: number;
  height: number;
  /** Seconds the field has been played. */
  time: number;
  /**
   * How far each element has swelled with its music, 0..1, moved toward what
   * the music asks at `MAX_SWELL_PER_SECOND` at most.
   */
  swells: number[];
}

/** One sprite placed on the frame. */
export interface IAmbientDraw {
  element: number;
  particle: IAmbientParticle;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  alpha: number;
  /**
   * Only for a `picture`: which of its poses to draw, each with its share of
   * `alpha`, so one pose dissolves into the next instead of snapping.
   */
  poses?: readonly (readonly [number, number])[];
}

/**
 * The brightest anything here is ever drawn, whatever the scene asks and
 * however loud the music: the ceiling `sceneAmbient.ts` declares, and the
 * same number, because two numbers for one rule means the rule is whichever
 * one the drawing uses.
 *
 * It was 0.62 while the declared ceiling was 0.42, and the swell below
 * multiplies past the ceiling before reaching it — so on loud music every
 * element drew half again as strong as the constant said was possible. These
 * are drawn over FluidEQ's own words: measured in sRGB, one white element at
 * 0.62 takes the text on a dark pane from 10.8:1 down to 2.0:1, and two
 * overlapping to 1.3:1, where 4.5:1 is the readable floor.
 */
/**
 * The most one shape may be worth INSIDE the layer's own canvas, which is
 * full strength — the ceiling is on the canvas now, not on the shape.
 *
 * It used to be `AMBIENT_CEILING` here, and that protected nothing, because
 * the shapes are drawn into one canvas before it is screened over the window:
 * two of them on the same spot composite to far more than either, and nothing
 * stops a scene putting all forty in the same place. Measured against white
 * text on the app's own panes, at the old per-shape ceiling of 0.42: one
 * shape leaves 4.55:1, two leave 2.18:1, four 1.27:1 and eight 1.03:1, where
 * 4.5:1 is the readable floor. Text under eight of them is gone.
 *
 * So the whole canvas carries `AMBIENT_CEILING` as its opacity
 * (`SceneAmbient.tsx`) and shapes are drawn at their strength relative to it.
 * A single shape lands exactly where it did — its alpha times the ceiling —
 * and any number of them stacked can do no more than a solid canvas at the
 * ceiling, which is the 4.55:1 case. The floor cannot be crossed by adding
 * shapes any more.
 */
const MAX_ALPHA = 1;
/**
 * The most the musical swell moves in a second, 0 to 1 being none to full.
 * A full swell takes two thirds of a second to arrive and to leave.
 */
export const MAX_SWELL_PER_SECOND = 1.5;

type TRandom = () => number;

const TAU = Math.PI * 2;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** The part of the window an area names, as [left, top, right, bottom]. */
export const areaBox = (
  area: TAmbientArea,
  width: number,
  height: number,
): readonly [number, number, number, number] => {
  if (area === 'top') {
    return [0, 0, width, height * 0.42];
  }
  if (area === 'bottom') {
    return [0, height * 0.58, width, height];
  }
  if (area === 'left') {
    return [0, 0, width * 0.32, height];
  }
  if (area === 'right') {
    return [width * 0.68, 0, width, height];
  }
  return [0, 0, width, height];
};

/** A place in `area`; for `edges`, within a sixth of the window of one of them. */
const placeIn = (
  element: IAmbientElement,
  width: number,
  height: number,
  random: TRandom,
): [number, number] => {
  if (element.area === 'edges') {
    const band = 0.16;
    const side = Math.floor(random() * 4);
    const along = random();
    const into = random() * band;
    if (side === 0) {
      return [along * width, into * height];
    }
    if (side === 1) {
      return [along * width, height - into * height];
    }
    if (side === 2) {
      return [into * width, along * height];
    }
    return [width - into * width, along * height];
  }
  const [left, top, right, bottom] = areaBox(element.area, width, height);
  return [left + random() * (right - left), top + random() * (bottom - top)];
};

const spawn = (
  element: IAmbientElement,
  width: number,
  height: number,
  random: TRandom,
): IAmbientParticle => {
  const [x, y] = placeIn(element, width, height, random);
  const seed = random();
  const [small, large] = element.size;
  // Birds and drifting things set off one way or the other; the rest face
  // anywhere.
  const eastward = random() < 0.5;
  const heading =
    element.motion === 'fly' || element.motion === 'drift'
      ? (eastward ? 0 : Math.PI) + (random() - 0.5) * 0.5
      : random() * TAU;
  return {
    x,
    y,
    heading,
    pace: 0.65 + random() * 0.7,
    phase: random() * TAU,
    spin: random() * TAU,
    spinRate: (random() - 0.5) * 1.2,
    size: small + (large - small) * random(),
    colour: Math.floor(random() * Math.max(1, element.colours.length)),
    seed,
    anchorX: x,
    anchorY: y,
  };
};

/** Counts brought within the window's total, each keeping its share. */
const fittedCounts = (elements: readonly IAmbientElement[]) => {
  const total = elements.reduce((sum, element) => sum + element.count, 0);
  return elements.map((element) =>
    total > MAX_AMBIENT_TOTAL
      ? Math.max(1, Math.floor((element.count * MAX_AMBIENT_TOTAL) / total))
      : element.count,
  );
};

export const createAmbientField = (
  elements: readonly IAmbientElement[],
  width: number,
  height: number,
  random: TRandom = Math.random,
): IAmbientField => {
  const counts = fittedCounts(elements);
  return {
    elements: [...elements],
    particles: elements.map((element, index) =>
      Array.from({ length: counts[index] }, () =>
        spawn(element, width, height, random),
      ),
    ),
    width,
    height,
    time: 0,
    swells: elements.map(() => 0),
  };
};

/**
 * The same field with new element settings — a control moved, a save — each
 * element keeping the ones already on their way, and adding or letting go of
 * as many as its count now asks. Sizes and colours follow the new settings.
 */
export const updateAmbientElements = (
  field: IAmbientField,
  elements: readonly IAmbientElement[],
  random: TRandom = Math.random,
): IAmbientField => {
  const counts = fittedCounts(elements);
  const particles = elements.map((element, index) => {
    const before =
      field.elements[index]?.id === element.id ? field.particles[index] : [];
    const kept = before.slice(0, counts[index]).map((particle) => ({
      ...particle,
      size:
        element.size[0] + (element.size[1] - element.size[0]) * particle.seed,
      // A picture brings no colours of its own to choose from.
      colour: particle.colour % Math.max(1, element.colours.length),
    }));
    while (kept.length < counts[index]) {
      kept.push(spawn(element, field.width, field.height, random));
    }
    return kept;
  });
  const swells = elements.map((element, index) =>
    field.elements[index]?.id === element.id ? (field.swells[index] ?? 0) : 0,
  );
  return { ...field, elements: [...elements], particles, swells };
};

/** The window changed size: every particle keeps its place in proportion. */
export const resizeAmbientField = (
  field: IAmbientField,
  width: number,
  height: number,
): IAmbientField => {
  if (field.width <= 0 || field.height <= 0) {
    return { ...field, width, height };
  }
  const sx = width / field.width;
  const sy = height / field.height;
  return {
    ...field,
    width,
    height,
    particles: field.particles.map((list) =>
      list.map((particle) => ({
        ...particle,
        x: particle.x * sx,
        y: particle.y * sy,
        anchorX: particle.anchorX * sx,
        anchorY: particle.anchorY * sy,
      })),
    ),
  };
};

const signalOf = (music: TAmbientMusic, levels: IAmbientMusicLevels) => {
  if (music === 'none') {
    return 0;
  }
  if (music === 'beat') {
    return clamp(levels.beat, 0, 1);
  }
  // Loud music's eased bands sit around 0.2 to 0.5: half is a full answer.
  return clamp(levels[music] / 0.5, 0, 1);
};

/** Speeds, in CSS pixels a second, at an element's slowest and fastest. */
const SPEEDS: Record<IAmbientElement['motion'], readonly [number, number]> = {
  fly: [26, 122],
  drift: [5, 37],
  wander: [6, 36],
  twinkle: [0, 2],
  fall: [8, 56],
  rise: [8, 50],
  sway: [0, 0],
};

const moveParticle = (
  element: IAmbientElement,
  particle: IAmbientParticle,
  field: IAmbientField,
  seconds: number,
  boost: number,
  random: TRandom,
) => {
  const { width, height, time } = field;
  const [slow, fast] = SPEEDS[element.motion];
  const speed = (slow + (fast - slow) * element.speed) * particle.pace * boost;
  const [left, top, right, bottom] =
    element.area === 'edges'
      ? [0, 0, width, height]
      : areaBox(element.area, width, height);
  const margin = particle.size * 2;
  const p = particle;
  switch (element.motion) {
    case 'fly': {
      // A shallow arc that bends on a slow wave of its own, never climbing
      // or diving steeper than a gull does.
      p.heading +=
        Math.sin(time * (0.25 + element.turn * 0.4) + p.seed * 20) *
        element.turn *
        0.5 *
        seconds;
      const east = Math.cos(p.heading) >= 0;
      const climb = clamp(Math.sin(p.heading), -0.4, 0.4);
      p.heading = east ? Math.asin(climb) : Math.PI - Math.asin(climb);
      p.x += Math.cos(p.heading) * speed * seconds;
      p.y += Math.sin(p.heading) * speed * seconds;
      p.phase += seconds * (6 + element.flap * 4) * p.pace;
      if (
        p.x < left - margin * 3 ||
        p.x > right + margin * 3 ||
        p.y < top - margin * 3 ||
        p.y > bottom + margin * 3
      ) {
        // Back in from one side or the other, at another height.
        const fromWest = random() < 0.5;
        p.x = fromWest ? left - margin * 2 : right + margin * 2;
        p.y = top + random() * (bottom - top);
        p.heading = (fromWest ? 0 : Math.PI) + (random() - 0.5) * 0.3;
      }
      break;
    }
    case 'drift': {
      p.x += Math.cos(p.heading) * speed * seconds;
      p.y +=
        (Math.sin(p.heading) * speed +
          Math.sin(time * 0.6 + p.seed * 10) * (3 + element.turn * 8)) *
        seconds;
      p.spin += p.spinRate * element.turn * seconds;
      if (p.x < left - margin) {
        p.x = right + margin;
      }
      if (p.x > right + margin) {
        p.x = left - margin;
      }
      if (p.y < top - margin) {
        p.y = bottom + margin;
      }
      if (p.y > bottom + margin) {
        p.y = top - margin;
      }
      break;
    }
    case 'wander': {
      p.heading +=
        (Math.sin(time * 0.23 + p.seed * 13) +
          0.6 * Math.sin(time * 0.51 + p.seed * 7)) *
        (0.35 + element.turn) *
        seconds;
      p.x += Math.cos(p.heading) * speed * seconds;
      p.y += Math.sin(p.heading) * speed * seconds;
      p.spin += p.spinRate * element.turn * 0.5 * seconds;
      p.phase += seconds * (1 + element.flap * 2);
      if (p.x < left || p.x > right) {
        p.heading = Math.PI - p.heading;
        p.x = clamp(p.x, left, right);
      }
      if (p.y < top || p.y > bottom) {
        p.heading = -p.heading;
        p.y = clamp(p.y, top, bottom);
      }
      break;
    }
    case 'twinkle': {
      p.x += (p.seed - 0.5) * speed * seconds;
      p.phase += seconds * (0.7 + element.flap * 2.3) * p.pace;
      break;
    }
    case 'fall':
    case 'rise': {
      const down = element.motion === 'fall' ? 1 : -1;
      p.y += down * speed * seconds;
      p.x +=
        Math.sin(time * 0.7 + p.seed * 12) * (4 + element.turn * 22) * seconds;
      p.spin += p.spinRate * (0.3 + element.turn) * seconds;
      p.phase += seconds * (1.5 + element.flap * 3);
      const gone = down > 0 ? p.y > bottom + margin : p.y < top - margin;
      if (gone) {
        p.y = down > 0 ? top - margin : bottom + margin;
        p.x = left + random() * (right - left);
      }
      break;
    }
    default: {
      // sway: where it stands, bobbing.
      p.x =
        p.anchorX +
        Math.sin(time * 0.5 + p.seed * 11) * (3 + element.turn * 10);
      p.y =
        p.anchorY + Math.sin(time * 0.37 + p.seed * 5) * (2 + element.turn * 6);
      p.spin = Math.sin(time * 0.4 + p.seed * 9) * element.turn * 0.5;
      p.phase += seconds * (0.6 + element.flap);
    }
  }
};

/**
 * Plays the field forward by `elapsedMs` — capped, so a window coming back
 * from minutes hidden resumes where it was instead of leaping — and returns
 * where to draw every particle this frame.
 */
export const stepAmbientField = (
  field: IAmbientField,
  elapsedMs: number,
  levels: IAmbientMusicLevels,
  random: TRandom = Math.random,
): IAmbientDraw[] => {
  const seconds = clamp(elapsedMs, 0, 100) / 1000;
  // eslint-disable-next-line no-param-reassign -- the field is the engine's own running state, moved in place every frame
  field.time += seconds;
  const draws: IAmbientDraw[] = [];
  field.elements.forEach((element, index) => {
    // The swell follows the music no faster than MAX_SWELL_PER_SECOND, so a
    // beat can breathe the elements but never strobe them: the eased levels
    // still rise in 90 ms, and a kick every half second at full reaction
    // blinked every shape in the window between two brightnesses.
    const wanted = element.react * signalOf(element.music, levels);
    const was = field.swells[index] ?? 0;
    const step = MAX_SWELL_PER_SECOND * seconds;
    const swell = clamp(wanted, was - step, was + step);
    // eslint-disable-next-line no-param-reassign -- the field is the engine's own running state, moved in place every frame
    field.swells[index] = swell;
    field.particles[index].forEach((particle) => {
      moveParticle(element, particle, field, seconds, 1 + swell * 0.3, random);
      const wave = 0.5 - 0.5 * Math.cos(particle.phase);
      let scaleX = 1;
      let scaleY = 1;
      let shimmer = 1;
      let rotation = 0;
      let poses: IAmbientDraw['poses'];
      if (element.shape === 'picture') {
        poses = picturePoses(element, particle, field.time);
        ({ scaleX, rotation, shimmer } = pictureBearing(
          element,
          particle,
          wave,
        ));
      } else if (element.shape === 'bird') {
        // Wings beat through the silhouette's height; every few seconds a
        // bird holds them out and glides.
        const glide =
          0.45 +
          0.55 * Math.max(0, Math.sin(field.time * 0.45 + particle.seed * 9));
        scaleY = 1 - element.flap * glide * wave * 1.55;
        const east = Math.cos(particle.heading) >= 0;
        scaleX = east ? 1 : -1;
        rotation = Math.sin(particle.heading) * (east ? 1 : -1) * 0.7;
      } else if (element.shape === 'star' || element.motion === 'twinkle') {
        shimmer = 1 - element.flap * 0.75 * wave;
        rotation = particle.spin * 0.1;
      } else {
        scaleX = 1 - element.flap * 0.45 * wave;
        rotation = particle.spin;
      }
      const swellScale = 1 + swell * 0.14;
      const variety = 0.6 + 0.4 * particle.seed;
      draws.push({
        element: index,
        particle,
        x: particle.x,
        y: particle.y,
        rotation,
        scaleX: scaleX * swellScale,
        scaleY: scaleY * swellScale,
        // Relative to the layer, which carries the ceiling itself: this times
        // `AMBIENT_CEILING` is what reaches the window, exactly as before.
        alpha: Math.min(
          MAX_ALPHA,
          element.opacity * variety * shimmer * (1 + swell * 0.8),
        ),
        ...(poses ? { poses } : {}),
      });
    });
  });
  return draws;
};
