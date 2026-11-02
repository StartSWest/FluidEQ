/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's part of the desk lights: it tells main what they play — the
 * look the member chose and owns, the pause, the time of day, the accent —
 * and shows the Lighting page the frames main sends back. It draws nothing
 * and listens to nothing: the lamps are main's scene host's
 * (`main/lighting/lampScenes.ts`), and outlive this window.
 */

import { act, render } from '@testing-library/react';
import { DEFAULT_GRAPH_LOOK_ID } from 'common/graphStyles';
import type {
  ILampPreview,
  ILampSceneChoice,
} from 'common/lighting/lampSceneChoice';
import type { IScenePacksListing } from 'main/ipc/scenePacks';
import { setSceneRenderingAvailableForTesting } from 'renderer/graph/sceneHealth';
import DynamicLightingLoop from 'renderer/lighting/DynamicLightingLoop';
import { subscribeLightingPreview } from 'renderer/lighting/lightingPreview';
import { setGraphLook } from 'renderer/utils/graphStyle';
import {
  adoptMemberSceneListingForTesting,
  resetMemberSceneStore,
} from 'renderer/utils/memberScenes';
import {
  adoptScenePackListingForTesting,
  resetScenePackStore,
} from 'renderer/utils/scenePacks';

let mockPaused = false;
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({ isPaused: mockPaused }),
}));

const AURORA = {
  id: 'aurora',
  version: 3,
  revision: 'rev-a',
  names: { en: 'Aurora' },
  fallbackStyle: 'area' as const,
  swatch: ['#00e5cf', '#ff3cac'],
} as IScenePacksListing['packs'][number];

const chooseLampScene = jest.fn<void, [ILampSceneChoice]>();
let preview: ((value: ILampPreview) => void) | undefined;
const frame = {
  width: 48,
  height: 27,
  rgb: new Uint8Array(48 * 27 * 3),
  level: 0.5,
  beat: 0,
  bass: 0,
  mid: 0,
  treble: 0,
  deltaMs: 33,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPaused = false;
  window.localStorage.clear();
  resetScenePackStore();
  resetMemberSceneStore();
  setSceneRenderingAvailableForTesting(true);
  act(() => setGraphLook('premium:aurora'));
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        chooseLampScene,
        onLampPreview: (listener: (value: ILampPreview) => void) => {
          preview = listener;
          return () => {
            preview = undefined;
          };
        },
      },
    },
  });
});

afterEach(() => {
  setSceneRenderingAvailableForTesting(undefined);
});

const listAll = () =>
  act(() => {
    adoptScenePackListingForTesting({ packs: [AURORA], locked: [] });
    adoptMemberSceneListingForTesting({ scenes: [], locked: [] });
  });

it('says nothing until the scene lists have arrived, then the look it owns', () => {
  render(<DynamicLightingLoop />);
  // Before the lists every look reads as unowned: saying so would put out a
  // desk main lit from what it kept.
  expect(chooseLampScene).not.toHaveBeenCalled();
  listAll();
  expect(chooseLampScene).toHaveBeenLastCalledWith(
    expect.objectContaining({
      scene: {
        lookId: 'premium:aurora',
        identity: 'premium:aurora@rev-a',
        swatch: AURORA.swatch,
        guarded: false,
      },
      paused: false,
      daylight: expect.objectContaining({ clock: false }),
    }),
  );
  const { accent } = chooseLampScene.mock.calls[0][0];
  expect(accent).toHaveLength(3);
});

it('says again when the pause or the look changes', () => {
  const { rerender } = render(<DynamicLightingLoop />);
  listAll();
  const told = chooseLampScene.mock.calls.length;
  mockPaused = true;
  rerender(<DynamicLightingLoop />);
  expect(chooseLampScene).toHaveBeenCalledTimes(told + 1);
  expect(chooseLampScene).toHaveBeenLastCalledWith(
    expect.objectContaining({ paused: true }),
  );
  // A look that is not a Plus one plays nothing on the desk.
  act(() => setGraphLook(DEFAULT_GRAPH_LOOK_ID));
  expect(chooseLampScene).toHaveBeenLastCalledWith(
    expect.objectContaining({ scene: null }),
  );
});

it('shows the page what main says the lamps showed', () => {
  render(<DynamicLightingLoop />);
  const seen: unknown[] = [];
  const stop = subscribeLightingPreview((shown) => seen.push(shown));
  act(() => preview?.({ frame }));
  expect(seen[seen.length - 1]).toBe(frame);
  stop();
});
