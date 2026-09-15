/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What lights the desk on the Dynamic lighting page of an account without
 * Plus: the one scene plays for the taste and no longer, its colours hold the
 * desk when there is no picture, nothing goes to a device, and a refreshed
 * listing does not hand out another taste.
 */

import { act, render } from '@testing-library/react';
import { PLUS_TASTE_SECONDS } from 'common/plusTerms';
import type { ILightingFrame } from 'common/lighting/lightingModel';
import { subscribeLightingPreview } from 'renderer/lighting/lightingPreview';
import type { ILampScenePlay } from 'renderer/lighting/lampScenePlay';
import {
  useDemoScene,
  useLightingDemo,
  type TLightingDemo,
} from 'renderer/plus/lighting/lightingDemo';
import type { ILockedScene } from 'renderer/utils/scenePacks';

const plays: { play: ILampScenePlay; closed: boolean }[] = [];
jest.mock('renderer/lighting/lampScenePlay', () => ({
  playLampScene: (play: ILampScenePlay) => {
    const entry = { play, closed: false };
    plays.push(entry);
    return {
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

let samples = new Set<string>(['alpine']);
jest.mock('renderer/plus/tasteSamples', () => ({
  useTasteSamples: () => samples,
}));

const alpine = (version = 49): ILockedScene => ({
  id: 'alpine',
  version,
  lookId: 'locked:alpine',
  names: { en: 'Alpine' },
  fallbackStyle: 'bars',
  swatch: ['#0b1a2e', '#7ad7ff'],
});
let locked: ILockedScene[] = [alpine()];
jest.mock('renderer/utils/scenePacks', () => ({
  useLockedScenes: () => locked,
}));

const previewGalleryScene = jest.fn(async () => ({
  ok: true as const,
  own: false,
  pack: { id: 'alpine', params: [], source: '// alpine' },
}));

const published: (ILightingFrame | undefined)[] = [];
const last = () => published[published.length - 1];
let stopPreview: () => void = () => undefined;

let latest: TLightingDemo | undefined;
function Demo({ pictureUrl }: { pictureUrl?: string }) {
  const scene = useDemoScene();
  latest = useLightingDemo(scene, pictureUrl);
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
  sceneId: 'premium:alpine',
  timeSeconds,
});

const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  plays.length = 0;
  published.length = 0;
  claim.mockClear();
  previewGalleryScene.mockClear();
  capture = { context: {}, source: {} };
  samples = new Set(['alpine']);
  locked = [alpine()];
  latest = undefined;
  window.electron = {
    ipcRenderer: { previewGalleryScene },
  } as unknown as typeof window.electron;
  stopPreview = subscribeLightingPreview((frame) => {
    published.push(frame);
  });
});

afterEach(() => {
  stopPreview();
  Reflect.deleteProperty(window, 'electron');
});

it('plays the sample scene for the taste, then holds the desk with its colours', async () => {
  const { unmount } = render(<Demo />);
  // Before anything is fetched the desk is already lit, by the palette.
  expect(latest).toEqual({ state: 'still', tasted: false });
  const wash = last();
  expect(wash?.sceneId).toBe('premium:alpine');
  expect(wash?.rgb.some((value) => value > 0)).toBe(true);

  await flush();
  expect(previewGalleryScene).toHaveBeenCalledWith(
    '00000000-0000-4000-8000-000000000001',
    'alpine',
    49,
  );
  expect(latest).toEqual({ state: 'playing' });
  expect(claim).toHaveBeenCalledWith('display');
  expect(plays).toHaveLength(1);
  const [{ play }] = plays;
  expect(play.guarded).toBe(false);
  expect(play.sceneId).toBe('premium:alpine');

  // The frames go to the page and nowhere else: no device bridge is called.
  const publishedBefore = published.length;
  act(() => play.onFrame(frameAt(3)));
  act(() => play.onFrame(frameAt(3 + PLUS_TASTE_SECONDS - 0.1)));
  expect(published.length).toBe(publishedBefore + 2);
  expect(latest).toEqual({ state: 'playing' });
  expect(plays[0].closed).toBe(false);

  act(() => play.onFrame(frameAt(3 + PLUS_TASTE_SECONDS)));
  expect(plays[0].closed).toBe(true);
  expect(latest).toEqual({ state: 'still', tasted: true });
  // The palette is back on the desk once the scene has had its turn.
  expect(last()?.rgb.some((value) => value > 0)).toBe(true);
  expect(plays).toHaveLength(1);

  unmount();
  // The page gone, the desk is given back.
  expect(last()).toBeUndefined();
});

it('keeps counting the taste across the output going away and coming back', async () => {
  const { rerender } = render(<Demo />);
  await flush();
  act(() => plays[0].play.onFrame(frameAt(0)));
  act(() => plays[0].play.onFrame(frameAt(6)));
  capture = undefined;
  rerender(<Demo pictureUrl={undefined} />);
  expect(plays[0].closed).toBe(true);
  expect(latest).toEqual({ state: 'still', tasted: false });
  capture = { context: {}, source: {} };
  rerender(<Demo pictureUrl={undefined} />);
  expect(plays).toHaveLength(2);
  act(() => plays[1].play.onFrame(frameAt(100)));
  act(() => plays[1].play.onFrame(frameAt(103)));
  expect(latest).toEqual({ state: 'playing' });
  act(() => plays[1].play.onFrame(frameAt(104.5)));
  // Six seconds, then four and a half: the ten are up.
  expect(latest).toEqual({ state: 'still', tasted: true });
});

it('does not start the taste over when the listing is refreshed with the same scene', async () => {
  const { rerender } = render(<Demo />);
  await flush();
  act(() => plays[0].play.onFrame(frameAt(0)));
  act(() => plays[0].play.onFrame(frameAt(PLUS_TASTE_SECONDS)));
  expect(latest).toEqual({ state: 'still', tasted: true });
  locked = [alpine()];
  rerender(<Demo />);
  await flush();
  expect(previewGalleryScene).toHaveBeenCalledTimes(1);
  expect(plays).toHaveLength(1);
  expect(latest).toEqual({ state: 'still', tasted: true });
  // A republished scene is another scene: it is tasted again.
  locked = [alpine(50)];
  rerender(<Demo />);
  await flush();
  expect(previewGalleryScene).toHaveBeenCalledTimes(2);
  expect(latest).toEqual({ state: 'playing' });
});

it('shows a scene the server does not give away as its colours, without asking for it', async () => {
  samples = new Set();
  render(<Demo />);
  await flush();
  expect(previewGalleryScene).not.toHaveBeenCalled();
  expect(claim).not.toHaveBeenCalled();
  expect(latest).toEqual({ state: 'still', tasted: false });
  expect(last()?.rgb.some((value) => value > 0)).toBe(true);
});

it('prefers Alpine, takes the first scene listed without it, and is dark with none', () => {
  locked = [{ ...alpine(), id: 'aurora', lookId: 'locked:aurora' }, alpine()];
  const { rerender } = render(<Demo />);
  expect(plays.length).toBe(0);
  expect(last()?.sceneId).toBe('premium:alpine');
  locked = [{ ...alpine(), id: 'aurora', lookId: 'locked:aurora' }];
  rerender(<Demo />);
  expect(last()?.sceneId).toBe('premium:aurora');
  locked = [];
  rerender(<Demo />);
  expect(latest).toEqual({ state: 'dark' });
  expect(last()).toBeUndefined();
});
