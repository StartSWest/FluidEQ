/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The scene the desk lights play: the Plus look the member chose, as long as
 * the account may play it. A free look lights nothing; a new version of the
 * scene is a new identity, and the same listing sent again is not.
 */

import { act, render } from '@testing-library/react';
import { DEFAULT_GRAPH_LOOK_ID } from 'common/graphStyles';
import type { IMemberScenesListing } from 'main/ipc/memberScenes';
import type { IScenePacksListing } from 'main/ipc/scenePacks';
import { setSceneRenderingAvailableForTesting } from 'renderer/graph/sceneHealth';
import { useLampScene, type ILampScene } from 'renderer/lighting/lampScene';
import { setGraphLook } from 'renderer/utils/graphStyle';
import {
  adoptMemberSceneListingForTesting,
  resetMemberSceneStore,
} from 'renderer/utils/memberScenes';
import {
  adoptScenePackListingForTesting,
  resetScenePackStore,
} from 'renderer/utils/scenePacks';

const AURORA = {
  id: 'aurora',
  version: 3,
  revision: 'rev-a',
  names: { en: 'Aurora' },
  fallbackStyle: 'area' as const,
  swatch: ['#00e5cf', '#ff3cac'],
} as IScenePacksListing['packs'][number];

const AUTHOR = '0b8f7c2e-4d3a-4b6f-9a1e-2c5d8e7f6a10';
const CAT = {
  lookId: `member:${AUTHOR}:cat`,
  authorId: AUTHOR,
  packId: 'cat',
  version: 6,
  revision: 'rev-cat',
  names: { en: 'Cat' },
  fallbackStyle: 'area' as const,
  swatch: ['#222222', '#ffaa00'],
  own: true,
} as IMemberScenesListing['scenes'][number];

const packs = (
  entitled: boolean,
  list: IScenePacksListing['packs'] = [AURORA],
): IScenePacksListing => ({ entitled, packs: list, locked: [] });

let seen: (ILampScene | null)[] = [];
function Probe() {
  seen.push(useLampScene());
  return null;
}
const current = () => seen[seen.length - 1];

beforeEach(() => {
  seen = [];
  window.localStorage.clear();
  resetScenePackStore();
  resetMemberSceneStore();
  setSceneRenderingAvailableForTesting(true);
  act(() => setGraphLook(DEFAULT_GRAPH_LOOK_ID));
});

afterEach(() => {
  setSceneRenderingAvailableForTesting(undefined);
});

it('lights nothing for a free look', () => {
  render(<Probe />);
  act(() => adoptScenePackListingForTesting(packs(true)));
  expect(current()).toBeNull();
});

it('plays the Plus look chosen, keyed on its content, and keeps the same answer for the same listing', () => {
  render(<Probe />);
  act(() => adoptScenePackListingForTesting(packs(true)));
  act(() => setGraphLook('premium:aurora'));
  const first = current();
  expect(first).toEqual({
    lookId: 'premium:aurora',
    identity: 'premium:aurora@rev-a',
    swatch: AURORA.swatch,
    guarded: false,
  });

  // The same scene listed again: nothing for the lamps to load.
  act(() => adoptScenePackListingForTesting(packs(true, [{ ...AURORA }])));
  expect(current()).toBe(first);

  // A new version is a new identity: the lamps load it.
  act(() =>
    adoptScenePackListingForTesting(
      packs(true, [{ ...AURORA, version: 4, revision: 'rev-b' }]),
    ),
  );
  expect(current()?.identity).toBe('premium:aurora@rev-b');
});

it('draws a member scene through the limiter', () => {
  render(<Probe />);
  act(() =>
    adoptMemberSceneListingForTesting({
      entitled: true,
      scenes: [CAT],
      locked: [],
    }),
  );
  act(() => setGraphLook(CAT.lookId));
  expect(current()).toMatchObject({
    lookId: CAT.lookId,
    identity: `${CAT.lookId}@rev-cat`,
    guarded: true,
  });
});

it('lights nothing when the account may not play the scene', () => {
  render(<Probe />);
  act(() => adoptScenePackListingForTesting(packs(true)));
  act(() => setGraphLook('premium:aurora'));
  expect(current()).not.toBeNull();
  act(() => adoptScenePackListingForTesting(packs(false, [])));
  expect(current()).toBeNull();
});
