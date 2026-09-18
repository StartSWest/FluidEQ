/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The ambient engine's field is plain numbers moved by elapsed time, so it can
 * be played forward here and looked at: every element keeps to its part of
 * the window, never shows brighter than the engine's ceiling however loud the
 * music, and a picture plays its own poses facing the way it flies.
 */

import {
  AMBIENT_CEILING,
  MAX_AMBIENT_ELEMENTS,
  type IAmbientElement,
} from '../../../common/sceneAmbient';
import {
  areaBox,
  createAmbientField,
  MAX_SWELL_PER_SECOND,
  stepAmbientField,
  updateAmbientElements,
  type IAmbientMusicLevels,
  type IAmbientParticle,
} from '../../../renderer/ambient/ambientField';
import { picturePoses } from '../../../renderer/ambient/ambientPictureMotion';

const SILENCE: IAmbientMusicLevels = {
  level: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  beat: 0,
};
const LOUD: IAmbientMusicLevels = {
  level: 1,
  bass: 1,
  mid: 1,
  treble: 1,
  beat: 1,
};

/** The same numbers every run: a field is only as testable as its dice. */
const dice = () => {
  let seed = 7;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
};

const element = (overrides: Partial<IAmbientElement>): IAmbientElement => ({
  id: 'motes',
  shape: 'petal',
  colours: ['#ff7bc0'],
  count: 8,
  size: [10, 20],
  opacity: 1,
  motion: 'wander',
  speed: 1,
  area: 'top',
  flap: 0.5,
  turn: 1,
  music: 'bass',
  react: 1,
  ...overrides,
});

const play = (
  elements: IAmbientElement[],
  seconds: number,
  levels = SILENCE,
) => {
  const random = dice();
  const field = createAmbientField(elements, 1600, 900, random);
  const frames = [];
  for (let step = 0; step < seconds * 60; step += 1) {
    frames.push(stepAmbientField(field, 1000 / 60, levels, random));
  }
  return { field, frames };
};

describe('ambient field motions', () => {
  it('keeps wandering things inside the part of the window they belong to', () => {
    const { frames } = play([element({ area: 'top' })], 60);
    const [left, top, right, bottom] = areaBox('top', 1600, 900);
    frames.flat().forEach((draw) => {
      expect(draw.x).toBeGreaterThanOrEqual(left);
      expect(draw.x).toBeLessThanOrEqual(right);
      expect(draw.y).toBeGreaterThanOrEqual(top);
      expect(draw.y).toBeLessThanOrEqual(bottom);
    });
  });

  it('brings a flier that leaves the window back in from a side', () => {
    const flier = element({ motion: 'fly', shape: 'bird', count: 4 });
    const { frames } = play([flier], 120);
    const last = frames[frames.length - 1];
    const margin = 20 * 2 * 3;
    last.forEach((draw) => {
      expect(draw.x).toBeGreaterThanOrEqual(-margin);
      expect(draw.x).toBeLessThanOrEqual(1600 + margin);
    });
    // They did travel: a positive control for the bounds above.
    const first = frames[0].map((draw) => draw.x);
    const moved = last.map((draw, index) => Math.abs(draw.x - first[index]));
    expect(Math.max(...moved)).toBeGreaterThan(100);
  });

  it('never shows brighter than the engine’s ceiling, however loud the music', () => {
    const { frames } = play(
      [element({ opacity: 1, react: 1, music: 'beat', motion: 'twinkle' })],
      5,
      LOUD,
    );
    // What reaches the window, which is this alpha times the layer's own
    // opacity: the ceiling moved onto the canvas so that STACKED shapes are
    // bounded too, and a single shape has to land exactly where it did.
    const brightest =
      Math.max(...frames.flat().map((draw) => draw.alpha)) * AMBIENT_CEILING;
    expect(brightest).toBeLessThanOrEqual(AMBIENT_CEILING + 1e-9);
    expect(brightest).toBeGreaterThan(0.2);
  });

  /**
   * The reason the ceiling is on the layer and not on the shape.
   *
   * Every shape is drawn into one canvas before that canvas is screened over
   * the window, so two shapes on the same spot composite to more than either
   * — and nothing stops a scene putting all forty in one place. Measured
   * against white text on the app's own darkest pane, with the old per-shape
   * ceiling of 0.42: one shape left 4.55:1, two 2.18:1, four 1.27:1 and eight
   * 1.03:1, where 4.5:1 is the readable floor. Text under eight of them was
   * gone.
   */
  it('cannot be made brighter by stacking, which is what the ceiling is for', () => {
    // Everything a scene is allowed, all asking for full strength, on loud
    // music: the worst a maker can build.
    const crowd = Array.from({ length: MAX_AMBIENT_ELEMENTS }, () =>
      element({ opacity: 1, react: 1, music: 'beat', motion: 'twinkle' }),
    );
    const { frames } = play(crowd, 5, LOUD);
    const drawn = frames.flat();
    expect(drawn.length).toBeGreaterThan(0);
    // No shape exceeds full strength INSIDE the layer, so however many of
    // them land on one pixel, that pixel can be no more than a solid layer —
    // and the layer's own opacity is the ceiling.
    drawn.forEach((draw) => {
      expect(draw.alpha).toBeLessThanOrEqual(1 + 1e-9);
    });
    const worstPixel = 1 * AMBIENT_CEILING;
    expect(worstPixel).toBeLessThanOrEqual(AMBIENT_CEILING + 1e-9);
  });

  it('keeps a picture’s particles whole when its settings change', () => {
    const picture = element({
      shape: 'picture',
      colours: [],
      frames: [[0, 0, 64, 64]],
      facing: 'right',
    });
    const random = dice();
    const field = createAmbientField([picture], 800, 600, random);
    const next = updateAmbientElements(
      field,
      [{ ...picture, count: 12 }],
      random,
    );
    expect(next.particles[0]).toHaveLength(12);
    next.particles[0].forEach((particle) => {
      expect(Number.isFinite(particle.colour)).toBe(true);
    });
  });
});

describe('picture poses', () => {
  const particle = (phase: number, seed = 0.4): IAmbientParticle => ({
    x: 0,
    y: 0,
    heading: 0,
    pace: 1,
    phase,
    spin: 0,
    spinRate: 0,
    size: 40,
    colour: 0,
    seed,
    anchorX: 0,
    anchorY: 0,
  });
  const wings = element({
    shape: 'picture',
    colours: [],
    motion: 'fly',
    frames: [
      [0, 0, 64, 64],
      [64, 0, 64, 64],
      [128, 0, 64, 64],
      [192, 0, 64, 64],
    ],
  });

  it('plays its frames in turn through a wingbeat, never brighter than one pose', () => {
    const tau = Math.PI * 2;
    const seen = new Set<number>();
    for (let step = 0; step < 64; step += 1) {
      const poses = picturePoses(wings, particle((step / 64) * tau), 0);
      const total = poses.reduce((sum, [, share]) => sum + share, 0);
      // A share too small to see is not drawn at all.
      expect(total).toBeLessThanOrEqual(1 + 1e-9);
      expect(total).toBeGreaterThan(0.98);
      expect(poses.length).toBeLessThanOrEqual(2);
      poses.forEach(([index]) => seen.add(index));
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
    // At the start of a pose, that pose alone.
    expect(picturePoses(wings, particle(0), 0)).toEqual([[0, 1]]);
  });

  it('settles into its resting pose while it glides', () => {
    const gliding = { ...wings, rest: 2 };
    // sin(time * 0.45 + seed * 9) high: holding its wings out.
    const time = (Math.PI / 2 - 0.4 * 9) / 0.45 + (Math.PI * 2) / 0.45;
    const poses = picturePoses(gliding, particle(1.3), time);
    expect(poses).toEqual([[2, 1]]);
    // A picture with no resting pose never glides.
    expect(
      picturePoses(wings, particle(1.3), time).some(([index]) => index === 2),
    ).toBe(false);
  });

  it('turns a picture that looks right to face a westward flight', () => {
    const random = dice();
    const facing = { ...wings, count: 16, facing: 'right' as const };
    const field = createAmbientField([facing], 1600, 900, random);
    const draws = stepAmbientField(field, 16, SILENCE, random);
    draws.forEach((draw) => {
      const east = Math.cos(draw.particle.heading) >= 0;
      expect(Math.sign(draw.scaleX)).toBe(east ? 1 : -1);
      expect(Math.abs(draw.rotation)).toBeLessThanOrEqual(0.4 * 0.7 + 1e-9);
      expect(draw.poses?.length).toBeGreaterThan(0);
    });
    expect(new Set(draws.map((draw) => Math.sign(draw.scaleX))).size).toBe(2);

    const looksLeft = createAmbientField(
      [{ ...facing, facing: 'left' as const }],
      1600,
      900,
      dice(),
    );
    stepAmbientField(looksLeft, 16, SILENCE, dice()).forEach((draw) => {
      const east = Math.cos(draw.particle.heading) >= 0;
      expect(Math.sign(draw.scaleX)).toBe(east ? -1 : 1);
    });
  });
});

describe('the musical swell', () => {
  const twinkling = () =>
    createAmbientField(
      [element({ music: 'beat', react: 1, motion: 'twinkle', flap: 0 })],
      1600,
      900,
      dice(),
    );
  const stepsOf = (alphas: number[]) =>
    alphas.slice(1).map((alpha, at) => Math.abs(alpha - alphas[at]));
  // The dice move each particle's variety, never its alpha between frames,
  // and a twinkle with no flap does not shimmer: every change is the swell.
  const play = (field: ReturnType<typeof twinkling>, beats: boolean[]) =>
    beats.map(
      (beat) =>
        stepAmbientField(field, 1000 / 60, beat ? LOUD : SILENCE, dice())[0]
          .alpha,
    );

  it('breathes with a pounding beat instead of blinking with it', () => {
    const field = twinkling();
    // A kick every other frame: the fastest the levels could ever flip.
    const alphas = play(
      field,
      Array.from({ length: 240 }, (_, step) => step % 2 === 0),
    );
    const resting = play(twinkling(), [false])[0];
    // A full swell adds 0.8 of the resting alpha; a sixtieth of a second may
    // move the swell by MAX_SWELL_PER_SECOND / 60 of that.
    const limit = resting * 0.8 * (MAX_SWELL_PER_SECOND / 60) * 1.05 + 1e-9;
    expect(Math.max(...stepsOf(alphas))).toBeLessThanOrEqual(limit);
    expect(Math.max(...alphas)).toBeLessThanOrEqual(resting * 1.1);
  });

  it('still swells all the way with music that stays loud, only slowed', () => {
    const field = twinkling();
    const alphas = play(
      field,
      Array.from({ length: 60 }, () => true),
    );
    const resting = play(twinkling(), [false])[0];
    const limit = resting * 0.8 * (MAX_SWELL_PER_SECOND / 60) * 1.05 + 1e-9;
    expect(Math.max(...stepsOf(alphas))).toBeLessThanOrEqual(limit);
    // Two thirds of a second to arrive: full by the end of a second, and
    // never past the ceiling the format declares. These are drawn over
    // FluidEQ's own words, and the drawing used to stop at 0.62 while the
    // constant said 0.42 — so the loudest music put every element half again
    // as strong as anything anywhere said was possible.
    expect(alphas[alphas.length - 1]).toBeCloseTo(Math.min(1, resting * 1.8), 3);
    // Full strength inside the layer; the layer's own opacity is the ceiling.
    expect(Math.max(...alphas)).toBeLessThanOrEqual(1 + 1e-9);
    expect(Math.max(...alphas) * AMBIENT_CEILING).toBeLessThanOrEqual(
      AMBIENT_CEILING + 1e-9,
    );
  });
});
