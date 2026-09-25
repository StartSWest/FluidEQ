/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One lamp player for as long as the lamps are lit. A capture that is
 * replaced is listened to afresh while the scene stays; a new scene is loaded
 * into the same worker while the one on the desk keeps drawing; a scene that
 * cannot be drawn lights the desk with its colours; and nothing is flashed
 * before the first picture.
 */

import type { IScenePack } from 'common/scenePacks';
import { DEFAULT_LIGHTING_PROFILE } from 'common/lighting/lightingProfiles';
import type { ICaptureGraph } from 'renderer/graph/useLiveOutputSpectrum';
import {
  createSpectrumTexels,
  createWaveformTexels,
} from 'renderer/graph/sceneUniforms';
import type { IHeardFrame } from 'renderer/lighting/lightingListener';
import { createLampPlayer } from 'renderer/lighting/lampScenePlay';

interface ISceneSeen {
  onGrid: (grid: Record<string, unknown>) => void;
  onFailed: (packId: string) => void;
  onReady: (packId: string) => void;
  load: jest.Mock;
  unload: jest.Mock;
  draw: jest.Mock;
  close: jest.Mock;
}

const scenes: ISceneSeen[] = [];
jest.mock('renderer/lighting/lightingSceneClient', () => ({
  createLightingScene: (
    onGrid: ISceneSeen['onGrid'],
    onFailed: ISceneSeen['onFailed'],
    onReady: ISceneSeen['onReady'],
  ) => {
    const seen: ISceneSeen = {
      onGrid,
      onFailed,
      onReady,
      load: jest.fn(),
      unload: jest.fn(),
      draw: jest.fn(),
      close: jest.fn(),
    };
    scenes.push(seen);
    return seen;
  },
}));

interface IListenerSeen {
  capture: unknown;
  onHeard: (heard: IHeardFrame) => void;
  close: jest.Mock;
}

const listeners: IListenerSeen[] = [];
jest.mock('renderer/lighting/lightingListener', () => ({
  startLightingListener: async (
    capture: unknown,
    _accent: unknown,
    _isPaused: unknown,
    onHeard: IListenerSeen['onHeard'],
  ) => {
    const seen: IListenerSeen = { capture, onHeard, close: jest.fn() };
    listeners.push(seen);
    return seen;
  },
}));

const packOf = (id: string) =>
  ({
    id,
    params: [],
    source: `// ${id}`,
    swatch: ['#ff0000'],
  }) as unknown as IScenePack;

const captureOf = () =>
  ({ context: {}, source: {} }) as unknown as ICaptureGraph;

const heardFrame = (): IHeardFrame => ({
  frame: {
    timeSeconds: 1,
    deltaMs: 33,
    level: 0.6,
    beat: 0.2,
    bands: [0.7, 0.5, 0.4],
    musicAccent: [0, 0],
    musicRun: [0, 0],
    rhythm: {} as never,
    accent: [1, 1, 1],
    fade: 1,
    spectrum: createSpectrumTexels().fill(200),
    waveform: createWaveformTexels(),
  },
  silent: false,
});

const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const player = () => {
  const onFrame = jest.fn();
  const onCannotHear = jest.fn();
  const lamps = createLampPlayer({
    isPaused: () => false,
    profile: () => DEFAULT_LIGHTING_PROFILE,
    onFrame,
    onCannotHear,
  });
  return { lamps, onFrame, onCannotHear, scene: scenes[scenes.length - 1] };
};

const grid = () => ({
  rgb: new Uint8Array(48 * 27 * 3),
  preview: { close: jest.fn() },
  level: 0.5,
  beat: 0,
  bass: 0.5,
  mid: 0.5,
  treble: 0.5,
  deltaMs: 33,
  timeSeconds: 1,
  activity: 1,
});

beforeEach(() => {
  scenes.length = 0;
  listeners.length = 0;
});

it('listens to a new capture without touching the scene', async () => {
  const { lamps, scene } = player();
  lamps.show({
    sceneId: 'premium:a',
    pack: packOf('a'),
    guarded: false,
    swatch: ['#ff0000'],
  });
  const first = captureOf();
  lamps.hear(first);
  await settle();
  lamps.hear(first);
  expect(listeners).toHaveLength(1);

  const second = captureOf();
  lamps.hear(second);
  await settle();
  expect(listeners[0].close).toHaveBeenCalledTimes(1);
  expect(listeners).toHaveLength(2);
  expect(listeners[1].capture).toBe(second);
  expect(scene.load).toHaveBeenCalledTimes(1);
  expect(scene.close).not.toHaveBeenCalled();
  expect(scenes).toHaveLength(1);
});

it('keeps the scene on the desk while the next links, each picture stamped with the scene in it', async () => {
  const { lamps, onFrame, scene } = player();
  lamps.show({
    sceneId: 'premium:a',
    pack: packOf('a'),
    guarded: false,
    swatch: ['#ff0000'],
  });
  lamps.hear(captureOf());
  await settle();
  scene.onReady('a');
  scene.onGrid(grid());
  expect(onFrame.mock.calls[0][0].sceneId).toBe('premium:a');

  lamps.show({
    sceneId: 'premium:b',
    pack: packOf('b'),
    guarded: true,
    swatch: ['#00ff00'],
  });
  expect(scene.load).toHaveBeenLastCalledWith(packOf('b'), true);
  // Linking: the music still reaches the worker, and the picture is a's.
  listeners[0].onHeard(heardFrame());
  expect(scene.draw).toHaveBeenCalledTimes(1);
  scene.onGrid(grid());
  expect(onFrame.mock.calls[1][0].sceneId).toBe('premium:a');

  scene.onReady('b');
  scene.onGrid(grid());
  expect(onFrame.mock.calls[2][0].sceneId).toBe('premium:b');
  expect(scenes).toHaveLength(1);
});

it('waits for the first picture rather than flashing the colours', async () => {
  const { lamps, onFrame, scene } = player();
  lamps.show({
    sceneId: 'premium:a',
    pack: packOf('a'),
    guarded: false,
    swatch: ['#ff0000'],
  });
  lamps.hear(captureOf());
  await settle();
  listeners[0].onHeard(heardFrame());
  expect(scene.draw).toHaveBeenCalledTimes(1);
  expect(onFrame).not.toHaveBeenCalled();
});

it('lights the desk with the colours of a scene that cannot be drawn, or could not be had', async () => {
  const { lamps, onFrame, scene } = player();
  lamps.show({
    sceneId: 'premium:a',
    pack: packOf('a'),
    guarded: false,
    swatch: ['#ff0000'],
  });
  lamps.hear(captureOf());
  await settle();
  scene.onFailed('a');
  listeners[0].onHeard(heardFrame());
  expect(scene.draw).not.toHaveBeenCalled();
  const [colours, image] = onFrame.mock.calls[0];
  expect(image).toBeUndefined();
  expect(colours.sceneId).toBe('premium:a');
  expect(colours.rgb.some((value: number) => value > 0)).toBe(true);

  // No pack at all: whatever the worker held is let go, and the colours stay.
  lamps.show({ sceneId: 'premium:c', guarded: false, swatch: ['#0000ff'] });
  expect(scene.unload).toHaveBeenCalledTimes(1);
  listeners[0].onHeard(heardFrame());
  expect(onFrame.mock.calls[1][0].sceneId).toBe('premium:c');
});

it('gives everything back when closed, and hears nothing after', async () => {
  const { lamps, onFrame, scene } = player();
  lamps.show({
    sceneId: 'premium:a',
    pack: packOf('a'),
    guarded: false,
    swatch: ['#ff0000'],
  });
  lamps.hear(captureOf());
  await settle();
  scene.onFailed('a');
  lamps.close();
  expect(listeners[0].close).toHaveBeenCalledTimes(1);
  expect(scene.close).toHaveBeenCalledTimes(1);
  listeners[0].onHeard(heardFrame());
  expect(onFrame).not.toHaveBeenCalled();
});
