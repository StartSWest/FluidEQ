/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import type { ISceneAmbient } from 'common/sceneAmbient';
import {
  MAX_POINTER_PIECES,
  readScenePointer,
  type IScenePointer,
} from 'common/scenePointer';
import useAmbientPictures from 'renderer/ambient/useAmbientPictures';
import ScenePointerLayer from 'renderer/graph/ScenePointerLayer';
import type {
  TGestureSource,
  TSceneGesture,
} from 'renderer/graph/sceneInteraction';
import { prefersReducedMotion } from 'renderer/utils/bandReveal';

jest.mock('renderer/ambient/ambientSprites', () => ({
  ambientSprite: ({ shape }: { shape: string }) => ({
    image: { shape },
    extent: 10,
  }),
}));
jest.mock('renderer/ambient/useAmbientPictures', () => jest.fn());
jest.mock('renderer/utils/bandReveal', () => ({
  prefersReducedMotion: jest.fn(() => false),
}));

/**
 * What a scene throws from the viewer's hand, drawn over it: a burst where
 * it is tapped, a trail as the hand crosses it — only over its own box, never
 * past the engine's ceiling of pieces, nothing for someone who asked for less
 * motion, and no frames at all once the last piece has gone.
 */

const pointerOf = (raw: unknown, elementIds?: string[]): IScenePointer => {
  const pointer = readScenePointer(raw, elementIds);
  if (!pointer) {
    throw new Error('the pointer did not read');
  }
  return pointer;
};

const SPARKS = pointerOf({
  emitters: [
    { on: 'tap', shape: 'spark', amount: 5, life: 1 },
    { on: 'move', shape: 'petal', amount: 3, life: 1 },
  ],
});

let drawnShapes: string[];
/** Every image drawn this frame, with the width it was drawn at. */
let drawnImages: { shape: string; width: number }[];
let operations: string[];
let frames: FrameRequestCallback[];
let clock: number;
let context: {
  translate: jest.Mock;
  rotate: jest.Mock;
  scale: jest.Mock;
};

/** The gestures a test makes, as the surface would tell them. */
const hand = () => {
  const listeners = new Set<(gesture: TSceneGesture) => void>();
  const source: TGestureSource = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    source,
    listening: () => listeners.size,
    tell: (gesture: TSceneGesture) =>
      act(() => listeners.forEach((listener) => listener(gesture))),
  };
};

/** The next frame the layer asked for, `ms` later; whether it asked. */
const nextFrame = (ms = 16) => {
  const step = frames.shift();
  if (!step) {
    return false;
  }
  clock += ms;
  drawnShapes = [];
  drawnImages = [];
  operations = [];
  context.translate.mockClear();
  context.rotate.mockClear();
  context.scale.mockClear();
  step(clock);
  return true;
};

beforeEach(() => {
  drawnShapes = [];
  drawnImages = [];
  operations = [];
  frames = [];
  clock = 1000;
  jest.mocked(useAmbientPictures).mockReturnValue(new Map());
  const canvasContext = {
    globalAlpha: 1,
    set globalCompositeOperation(operation: string) {
      operations.push(operation);
    },
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    drawImage: jest.fn(
      (image: { shape: string }, _x: number, _y: number, width = 0) => {
        drawnShapes.push(image.shape);
        drawnImages.push({ shape: image.shape, width });
      },
    ),
  };
  context = canvasContext;
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(canvasContext as unknown as CanvasRenderingContext2D);
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect')
    .mockReturnValue({
      left: 100,
      top: 50,
      width: 400,
      height: 200,
    } as DOMRect);
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((step) => {
    frames.push(step);
    return frames.length;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frames = [];
  });
  jest.spyOn(performance, 'now').mockImplementation(() => clock);
  jest.mocked(prefersReducedMotion).mockReturnValue(false);
});

afterEach(() => jest.restoreAllMocks());

const layer = (
  source: TGestureSource,
  pointer = SPARKS,
  ambient: ISceneAmbient | undefined = undefined,
) =>
  render(
    <ScenePointerLayer
      gestures={source}
      pointer={pointer}
      ambient={ambient}
      artwork={undefined}
    />,
  );

describe('what a scene throws from the hand', () => {
  it('bursts where it is tapped, and lights add to the scene', () => {
    const { source, tell } = hand();
    layer(source);
    tell({ kind: 'tap', x: 300, y: 150 });

    expect(nextFrame()).toBe(true);
    expect(drawnShapes).toEqual(Array(5).fill('spark'));
    expect(operations).toContain('lighter');
  });

  it('leaves a trail by the distance the hand travels, carrying the rest', () => {
    const { source, tell } = hand();
    layer(source);
    // Three a hundred pixels: the first fifty owe one and a half, so one is
    // thrown and the half carried; with the next fifty's it makes two.
    tell({ kind: 'move', x: 300, y: 150, dx: 50, dy: 0 });
    tell({ kind: 'move', x: 350, y: 150, dx: 50, dy: 0 });

    nextFrame();
    expect(drawnShapes).toEqual(['petal', 'petal', 'petal']);
  });

  it('throws nothing for a hand outside its box', () => {
    const { source, tell } = hand();
    layer(source);
    tell({ kind: 'tap', x: 900, y: 150 });
    expect(frames).toHaveLength(0);
  });

  it('throws nothing for someone who asked for less motion', () => {
    jest.mocked(prefersReducedMotion).mockReturnValue(true);
    const { source, tell } = hand();
    layer(source);
    tell({ kind: 'tap', x: 300, y: 150 });
    expect(frames).toHaveLength(0);
  });

  it(`keeps ${MAX_POINTER_PIECES} pieces in the air at most`, () => {
    const { source, tell } = hand();
    layer(source);
    for (let tap = 0; tap < 40; tap += 1) {
      tell({ kind: 'tap', x: 300, y: 150 });
    }
    nextFrame();
    expect(drawnShapes).toHaveLength(MAX_POINTER_PIECES);
  });

  it('asks for no more frames once the last piece has gone', () => {
    const { source, tell } = hand();
    layer(source);
    tell({ kind: 'tap', x: 300, y: 150 });
    // Each piece lives up to one and a quarter of its second.
    let ran = 0;
    while (nextFrame(100)) {
      ran += 1;
    }
    expect(ran).toBeGreaterThan(5);
    expect(ran).toBeLessThan(20);
    expect(drawnShapes).toEqual([]);
  });

  it('stops listening to the hand when it goes', () => {
    const { source, listening } = hand();
    const { unmount } = layer(source);
    expect(listening()).toBe(1);
    unmount();
    expect(listening()).toBe(0);
  });
});

/**
 * A creature a tap puts up - Alpine's birds, Coral's fish - flies off rather
 * than tumbling: facing the way it goes and leaning into its climb, beating
 * its wings through its poses, bigger thrown low on the scene than high up,
 * and dwindling as it flies away.
 */
describe('a creature thrown from the hand', () => {
  const POSES = ['wings up', 'wings level', 'wings down', 'wings in'];
  const GULLS: ISceneAmbient = {
    elements: [
      {
        id: 'gulls',
        shape: 'picture',
        // Twice as wide as tall: drawn the size's width.
        frames: POSES.map((_, index) => [index * 64, 0, 64, 32] as const),
        rest: 1,
        facing: 'right',
        colours: [],
        count: 4,
        size: [20, 30],
        opacity: 1,
        motion: 'fly',
        speed: 0.5,
        area: 'top',
        flap: 0.5,
        turn: 0.5,
        music: 'mid',
        react: 0,
      },
    ],
    params: [],
  };
  const FLOCK = pointerOf(
    {
      emitters: [
        {
          on: 'tap',
          element: 'gulls',
          amount: 3,
          size: [20, 20],
          life: 2,
          speed: 0.5,
          spread: 0.5,
          gravity: -0.3,
        },
      ],
    },
    ['gulls'],
  );

  beforeEach(() => {
    const poses = POSES.map((shape) => ({ shape }) as unknown);
    jest
      .mocked(useAmbientPictures)
      .mockReturnValue(new Map([['gulls', poses as OffscreenCanvas[]]]));
  });

  /** The widest anything was drawn in the last frame. */
  const widest = () => Math.max(...drawnImages.map(({ width }) => width));

  it('faces the way it flies and leans into its climb, never turned at random', () => {
    // Below a half every bird goes off to the left, above it to the right.
    const random = jest.spyOn(Math, 'random').mockReturnValue(0.25);
    const { source, tell } = hand();
    const { unmount } = layer(source, FLOCK, GULLS);
    tell({ kind: 'tap', x: 300, y: 150 });
    nextFrame();
    // Mirrored, since its picture looks right; its nose, on the left, raised.
    expect(context.scale.mock.calls).toEqual(Array(3).fill([-1, 1]));
    context.rotate.mock.calls.forEach(([rotation]) =>
      expect(rotation).toBeCloseTo(0.28),
    );
    unmount();

    random.mockReturnValue(0.75);
    const right = hand();
    layer(right.source, FLOCK, GULLS);
    right.tell({ kind: 'tap', x: 300, y: 150 });
    nextFrame();
    expect(context.scale.mock.calls).toEqual(Array(3).fill([1, 1]));
    // A shallower climb, 16 degrees above level: its nose on the right
    // raised by 0.7 of the climb's sine, short of the 0.28 a steep one gets.
    expect(context.rotate.mock.calls).toHaveLength(3);
    context.rotate.mock.calls.forEach(([rotation]) => {
      expect(rotation).toBeLessThan(-0.15);
      expect(rotation).toBeGreaterThan(-0.28);
    });
  });

  /** How far the first piece travelled over `count` more frames. */
  const travel = (count: number) => {
    const [fromX, fromY] = context.translate.mock.calls[0];
    for (let frame = 0; frame < count; frame += 1) {
      nextFrame();
    }
    const [toX, toY] = context.translate.mock.calls[0];
    return Math.hypot(toX - fromX, toY - fromY);
  };

  it('is bigger and quicker thrown low on the scene, where it is near, than high up', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const low = hand();
    const { unmount } = layer(low.source, FLOCK, GULLS);
    // The box is 200 tall from 50: 190 down is near, 10 down is far.
    low.tell({ kind: 'tap', x: 300, y: 240 });
    nextFrame();
    const near = widest();
    const nearTravel = travel(10);
    unmount();

    const high = hand();
    layer(high.source, FLOCK, GULLS);
    high.tell({ kind: 'tap', x: 300, y: 60 });
    nextFrame();
    const far = widest();
    const farTravel = travel(10);
    expect(near).toBeCloseTo(20 * 1.925, 0);
    expect(near / far).toBeCloseTo(1.925 / 0.575, 1);
    expect(nearTravel / farTravel).toBeCloseTo(1.925 / 0.575, 1);
  });

  it('beats its wings through every one of its poses', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    const { source, tell } = hand();
    layer(source, FLOCK, GULLS);
    tell({ kind: 'tap', x: 300, y: 150 });
    const seen = new Set<string>();
    // One wingbeat, a little under a third of a second.
    for (let frame = 0; frame < 20; frame += 1) {
      nextFrame();
      drawnShapes.forEach((shape) => seen.add(shape));
      // One pose dissolving into the next, at most, for each of the three.
      expect(drawnShapes.length).toBeLessThanOrEqual(6);
    }
    expect(seen).toEqual(new Set(POSES));
  });

  it('flies up and away, faster and smaller as it goes', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0.75);
    const { source, tell } = hand();
    layer(source, FLOCK, GULLS);
    tell({ kind: 'tap', x: 300, y: 150 });
    nextFrame();
    const [fromX, fromY] = context.translate.mock.calls[0];
    const fromWidth = widest();
    const firstStride = travel(1);
    for (let frame = 0; frame < 92; frame += 1) {
      nextFrame();
    }
    const [toX, toY] = context.translate.mock.calls[0];
    expect(toY).toBeLessThan(fromY - 100);
    expect(toX).toBeGreaterThan(fromX + 100);
    expect(widest()).toBeLessThan(fromWidth * 0.8);
    // Nothing brakes it: a second and a half on it covers more a frame.
    expect(travel(1)).toBeGreaterThan(firstStride * 1.3);
  });
});
