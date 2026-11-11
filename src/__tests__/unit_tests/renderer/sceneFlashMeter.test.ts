/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The flash meter the review of a scene reads (2026-11-11), on pictures
 * whose answer is known: WCAG 2.3.1 allows three flashes a second and no
 * more, over an area of about a quarter of the view, in light or in
 * saturated red. Each case that must trip it stands beside one that must not.
 */

import {
  FLASH_STATE_REST,
  flashPressureMemory,
  flashStep,
  type IFlashState,
} from '../../../renderer/graph/sceneFlashGuard';
import {
  createFlashMeter,
  createFlashTally,
  flashVerdictOf,
  stepFlashPixels,
  type IFlashSummary,
} from '../../../renderer/graph/sceneFlashMeter';

const WIDTH = 480;
const HEIGHT = 270;
const FPS = 30;
const FRAME_MS = 1000 / FPS;

type TPainter = (x: number, y: number, t: number) => [number, number, number];

/** `seconds` of a picture painted by `paint`, measured and summed up. */
const measure = (paint: TPainter, seconds = 3): IFlashSummary => {
  const meter = createFlashMeter(WIDTH, HEIGHT);
  const tally = createFlashTally();
  const rgba = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  const frames = Math.round(seconds * FPS);
  for (let frame = 0; frame < frames; frame += 1) {
    const t = frame / FPS;
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const [r, g, b] = paint(x, y, t);
        const at = (y * WIDTH + x) * 4;
        rgba[at] = r;
        rgba[at + 1] = g;
        rgba[at + 2] = b;
        rgba[at + 3] = 255;
      }
    }
    tally.add(meter.frame(rgba, FRAME_MS), t);
  }
  return tally.summary();
};

/** Bright for the first half of each cycle at `perSecond`, dark for the rest. */
const square = (perSecond: number, t: number) =>
  (t * perSecond) % 1 < 0.5 ? 255 : 0;

const grey = (v: number): [number, number, number] => [v, v, v];

describe('the flash meter', () => {
  it('fails a whole frame strobing five times a second', () => {
    const strobe = measure((_x, _y, t) => grey(square(5, t)));
    expect(strobe.verdict).toBe('fails');
    expect(strobe.worstAreaShare).toBeGreaterThan(0.9);
    // Over the line within a tenth of a second of each rise: three frames of
    // every six, from its second rise on.
    expect(strobe.flashingShare).toBeGreaterThan(0.4);
    // From its second rise, a fifth of a second after the first.
    expect(strobe.firstAtSeconds).toBeLessThan(0.5);
  });

  it('leaves the same strobe alone at three a second, WCAG’s own line, and at two', () => {
    expect(measure((_x, _y, t) => grey(square(3, t))).verdict).toBe('none');
    expect(measure((_x, _y, t) => grey(square(2, t))).verdict).toBe('none');
  });

  it('fails a square a third of the frame across flickering ten times a second', () => {
    const patch = measure((x, y, t) =>
      grey(x < 160 && y < 160 ? square(10, t) : 40),
    );
    expect(patch.verdict).toBe('fails');
  });

  it('passes a strip a sixteenth of the frame flickering as fast, at the frame’s edge, the way flame tips do', () => {
    // Under a quarter of a 10-degree field: within WCAG's line, worth a look.
    const tips = measure((x, _y, t) =>
      grey(x < WIDTH / 16 ? square(10, t) : 40),
    );
    expect(tips.verdict).toBe('some');
    expect(tips.flashingShare).toBe(0);
    expect(tips.worstAreaShare).toBeLessThanOrEqual(0.25);
  });

  it('fails a red flash that keeps the light the same, which a measure of light alone misses', () => {
    // Saturated red against a grey of the same relative luminance.
    const red: [number, number, number] = [255, 0, 0];
    const sameLight = grey(Math.round(255 * 0.2126 ** (1 / 2.2)));
    const flash = measure((_x, _y, t) => ((t * 4) % 1 < 0.5 ? red : sameLight));
    expect(flash.verdict).toBe('fails');
    // The control: the same grey both ways is no flash at all.
    expect(measure(() => sameLight).verdict).toBe('none');
  });

  // WCAG counts flashes "occurring concurrently". Stripes over two fifths of
  // the frame strobing five times a second fail when they strobe together;
  // spread over the period, no more than half of them flash at one moment.
  it('counts only flashes at the same moment, not every pixel that flashed lately', () => {
    const stripes = (spread: boolean) =>
      measure((x, _y, t) => {
        if (x % 10 >= 4) {
          return grey(30);
        }
        const phase = spread ? (Math.floor(x / 10) % 8) / 8 : 0;
        return grey((t * 5 + phase) % 1 < 0.5 ? 255 : 30);
      });
    expect(stripes(false).verdict).toBe('fails');
    const spread = stripes(true);
    expect(spread.verdict).toBe('some');
    expect(spread.worstAreaShare).toBeLessThanOrEqual(0.25);
  });

  it('leaves a bright bar sweeping across a dark frame alone: motion is not flashing', () => {
    const bar = measure((x, _y, t) =>
      grey(Math.abs(x - ((t * 400) % WIDTH)) < 40 ? 255 : 0),
    );
    expect(bar.verdict).toBe('none');
  });

  it('says when the worst came, and how much was measured', () => {
    // Calm, then a strobe from the second second.
    const late = measure((_x, _y, t) => grey(t < 2 ? 60 : square(6, t)), 4);
    expect(late.firstAtSeconds).toBeGreaterThanOrEqual(2);
    expect(late.worstAtSeconds).toBeGreaterThanOrEqual(2);
    expect(late.framesMeasured).toBe(120);
    expect(late.seconds).toBeCloseTo(119 / FPS, 5);
  });
});

describe('the step every pixel takes', () => {
  it('is `flashStep` exactly, for any run of swings at any frame time', () => {
    const pixels = 64;
    const swings = new Float32Array(pixels);
    const travel = new Float32Array(pixels);
    const since = new Float32Array(pixels).fill(FLASH_STATE_REST.sinceTurn);
    const flashing = new Float32Array(pixels);
    const sinceFlash = new Float32Array(pixels).fill(1);
    const states: IFlashState[] = Array.from({ length: pixels }, () => ({
      ...FLASH_STATE_REST,
    }));
    const travelled = new Array<number>(pixels).fill(0);
    // A fixed sequence, so a failure can be run again.
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed / 2 ** 31;
    };
    for (let frame = 0; frame < 400; frame += 1) {
      const deltaMs = [4, 7, 16.7, 33.3, 120][frame % 5];
      for (let i = 0; i < pixels; i += 1) {
        // Mostly small moves, now and then a whole flash's worth.
        swings[i] = next() < 0.2 ? (next() - 0.5) * 0.6 : (next() - 0.5) * 0.08;
        const swing = swings[i];
        states[i] = flashStep(states[i], swing, travelled[i], deltaMs);
        travelled[i] = flashPressureMemory(swing, travelled[i], deltaMs);
      }
      stepFlashPixels(swings, travel, since, flashing, sinceFlash, deltaMs);
      for (let i = 0; i < pixels; i += 1) {
        expect(flashing[i]).toBeCloseTo(states[i].flashing, 5);
        expect(since[i]).toBeCloseTo(states[i].sinceTurn, 5);
        expect(travel[i]).toBeCloseTo(travelled[i], 5);
      }
    }
    // The control: the run did flash, so the comparison saw a flag set.
    expect(states.some((state) => state.flashing > 0)).toBe(true);
  });
});

describe('the verdict', () => {
  it('fails over a quarter of a field, as WCAG 2.3.1 does, and asks for a look from a tenth', () => {
    expect(flashVerdictOf(0)).toBe('none');
    expect(flashVerdictOf(0.1)).toBe('none');
    expect(flashVerdictOf(0.11)).toBe('some');
    expect(flashVerdictOf(0.25)).toBe('some');
    expect(flashVerdictOf(0.26)).toBe('fails');
    expect(flashVerdictOf(1)).toBe('fails');
  });
});
