/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What lights the desk on the Dynamic lighting page of an account without
 * Plus: the scene the main process hands over plays for as long as the page
 * is open, every frame goes to the desk and to the devices, its colours hold
 * the desk when it cannot play, and the page closing gives everything back.
 */

import { act, render } from '@testing-library/react';
import type { ILightingFrame } from 'common/lighting/lightingModel';
import type { IScenePack } from 'common/scenePacks';
import { subscribeLightingPreview } from 'renderer/lighting/lightingPreview';
import type {
  ILampPlayerOptions,
  ILampSceneShown,
} from 'renderer/lighting/lampScenePlay';
import {
  useLightingDemo,
  type TLightingDemo,
} from 'renderer/plus/lighting/lightingDemo';

interface IPlayerSeen {
  options: ILampPlayerOptions;
  shown: ILampSceneShown[];
  heard: unknown[];
  closed: boolean;
}

const players: IPlayerSeen[] = [];
jest.mock('renderer/lighting/lampScenePlay', () => ({
  createLampPlayer: (options: ILampPlayerOptions) => {
    const entry: IPlayerSeen = { options, shown: [], heard: [], closed: false };
    players.push(entry);
    return {
      show: (scene: ILampSceneShown) => entry.shown.push(scene),
      hear: (capture: unknown) => entry.heard.push(capture),
      close: () => {
        entry.closed = true;
      },
    };
  },
}));

let capture: object | undefined = { context: {}, source: {} };
const claim = jest.fn((_kind?: string) => () => undefined);
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({ capture, isPaused: false, claim }),
  useLiveAudioCapture: (wanted: boolean, kind: string) => {
    if (wanted) {
      claim(kind);
    }
  },
}));

const starter = {
  id: 'lantern-night',
  params: [],
  source: '// starter',
  swatch: ['#0d0b26', '#ff8a4c'],
  names: { en: 'Lantern night' },
} as unknown as IScenePack;

const lightingDemoScene = jest.fn(
  async (): Promise<IScenePack | null> => starter,
);
const sendLightingDemoFrame = jest.fn();
const releaseLighting = jest.fn();

const published: (ILightingFrame | undefined)[] = [];
const last = () => published[published.length - 1];
let stopPreview: () => void = () => undefined;

let latest: TLightingDemo | undefined;
function Demo() {
  latest = useLightingDemo();
  return null;
}

const frameAt = (timeSeconds: number): ILightingFrame => ({
  width: 48,
  height: 27,
  rgb: new Uint8Array(48 * 27 * 3),
  level: 0.5,
  beat: 0,
  bass: 0.5,
  mid: 0.5,
  treble: 0.5,
  deltaMs: 33,
  sceneId: 'lantern-night',
  timeSeconds,
});

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  players.length = 0;
  published.length = 0;
  claim.mockClear();
  lightingDemoScene.mockClear();
  sendLightingDemoFrame.mockClear();
  releaseLighting.mockClear();
  capture = { context: {}, source: {} };
  latest = undefined;
  window.electron = {
    ipcRenderer: { lightingDemoScene, sendLightingDemoFrame, releaseLighting },
  } as unknown as typeof window.electron;
  stopPreview = subscribeLightingPreview((frame) => {
    published.push(frame);
  });
});

afterEach(() => {
  stopPreview();
  Reflect.deleteProperty(window, 'electron');
});

it('plays the scene main hands over, on the desk and on the devices, for as long as the page is open', async () => {
  const { unmount } = render(<Demo />);
  await flush();
  expect(lightingDemoScene).toHaveBeenCalledTimes(1);
  expect(latest).toEqual({ state: 'playing', pack: starter });
  expect(claim).toHaveBeenCalledWith('display');
  expect(players).toHaveLength(1);
  const [player] = players;
  expect(player.shown).toEqual([
    {
      sceneId: 'lantern-night',
      pack: starter,
      guarded: false,
      swatch: starter.swatch,
    },
  ]);
  expect(player.heard).toEqual([capture]);

  // Every frame reaches the desk and the devices, well past any taste.
  act(() => player.options.onFrame(frameAt(3)));
  act(() => player.options.onFrame(frameAt(600)));
  expect(sendLightingDemoFrame).toHaveBeenCalledTimes(2);
  expect(sendLightingDemoFrame).toHaveBeenLastCalledWith(frameAt(600));
  expect(last()).toEqual(frameAt(600));
  expect(latest).toEqual({ state: 'playing', pack: starter });
  expect(player.closed).toBe(false);

  unmount();
  // The page gone, the scene stops and the desk and the devices are given
  // back — the devices never keep the last frame.
  expect(player.closed).toBe(true);
  expect(releaseLighting).toHaveBeenCalled();
  expect(last()).toBeUndefined();
});

it('holds the desk with the colours until the scene plays, and while it cannot', async () => {
  capture = undefined;
  const { rerender } = render(<Demo />);
  await flush();
  // The scene is there, with nothing to hear: its colours, not a dark desk,
  // and the devices are not left holding anything.
  expect(latest).toEqual({ state: 'still', pack: starter });
  expect(last()?.sceneId).toBe('lantern-night');
  expect(last()?.rgb.some((value) => value > 0)).toBe(true);
  expect(players).toHaveLength(1);
  expect(players[0].heard).toEqual([undefined]);
  expect(releaseLighting).toHaveBeenCalled();
  expect(sendLightingDemoFrame).not.toHaveBeenCalled();

  // The capture comes: the same player hears it, no second one is made.
  capture = { context: {}, source: {} };
  rerender(<Demo />);
  expect(players).toHaveLength(1);
  expect(players[0].heard).toEqual([undefined, capture]);
  expect(latest).toEqual({ state: 'playing', pack: starter });

  // An output that cannot be listened to: the colours again, devices back.
  releaseLighting.mockClear();
  act(() => players[0].options.onCannotHear());
  expect(players[0].closed).toBe(true);
  expect(releaseLighting).toHaveBeenCalled();
  expect(latest).toEqual({ state: 'still', pack: starter });
  expect(last()?.rgb.some((value) => value > 0)).toBe(true);
});

it('is dark when main hands no scene over, or the window predates the demo', async () => {
  lightingDemoScene.mockResolvedValueOnce(null);
  const { unmount } = render(<Demo />);
  await flush();
  expect(latest).toEqual({ state: 'dark' });
  expect(players).toHaveLength(0);
  expect(claim).not.toHaveBeenCalled();
  unmount();

  window.electron = { ipcRenderer: {} } as unknown as typeof window.electron;
  render(<Demo />);
  await flush();
  expect(latest).toEqual({ state: 'dark' });
});
