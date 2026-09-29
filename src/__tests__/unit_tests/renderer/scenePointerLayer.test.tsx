/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { act, render } from '@testing-library/react';
import {
  MAX_POINTER_PIECES,
  readScenePointer,
  type IScenePointer,
} from 'common/scenePointer';
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
jest.mock('renderer/ambient/useAmbientPictures', () => () => new Map());
jest.mock('renderer/utils/bandReveal', () => ({
  prefersReducedMotion: jest.fn(() => false),
}));

/**
 * What a scene throws from the viewer's hand, drawn over it: a burst where
 * it is tapped, a trail as the hand crosses it — only over its own box, never
 * past the engine's ceiling of pieces, nothing for someone who asked for less
 * motion, and no frames at all once the last piece has gone.
 */

const pointerOf = (raw: unknown): IScenePointer => {
  const pointer = readScenePointer(raw);
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
let operations: string[];
let frames: FrameRequestCallback[];
let clock: number;

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
  operations = [];
  step(clock);
  return true;
};

beforeEach(() => {
  drawnShapes = [];
  operations = [];
  frames = [];
  clock = 1000;
  const context = {
    globalAlpha: 1,
    set globalCompositeOperation(operation: string) {
      operations.push(operation);
    },
    setTransform: jest.fn(),
    clearRect: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    scale: jest.fn(),
    drawImage: jest.fn((image: { shape: string }) =>
      drawnShapes.push(image.shape),
    ),
  };
  jest
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
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

const layer = (source: TGestureSource, pointer = SPARKS) =>
  render(
    <ScenePointerLayer
      gestures={source}
      pointer={pointer}
      ambient={undefined}
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
