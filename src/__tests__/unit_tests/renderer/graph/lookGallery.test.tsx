/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph's looks as a gallery (Ivan, 2026-11-19): the look on the graph,
 * the ones either side of it in the same walk the arrows and Space use, and
 * who a heart on each thanks - FluidEQ's own scenes and members', never a
 * standard look ("solo las plus").
 */

import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { DEFAULT_GRAPH_LOOK_ID } from 'common/graphStyles';
import type { IMemberScenesListing } from 'main/ipc/memberScenes';
import type { IScenePacksListing } from 'main/ipc/scenePacks';
import { useLookGallery } from 'renderer/graph/lookGallery';
import { setSceneRenderingAvailableForTesting } from 'renderer/graph/sceneHealth';
import { getLookWalk, setGraphLook } from 'renderer/utils/graphStyle';
import { I18nProvider } from 'renderer/utils/I18nContext';
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
  swatch: ['#00e5cf', '#ff3cac'],
} as IScenePacksListing['packs'][number];

const AUTHOR = '0b8f7c2e-4d3a-4b6f-9a1e-2c5d8e7f6a10';
const memberScene = (own: boolean) =>
  ({
    lookId: `member:${AUTHOR}:cat`,
    authorId: AUTHOR,
    packId: 'cat',
    version: 6,
    revision: 'rev-cat',
    names: { en: 'Cat' },
    swatch: ['#222222', '#ffaa00'],
    own,
    authorName: 'Rosa',
  }) as IMemberScenesListing['scenes'][number];

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nProvider>{children}</I18nProvider>
);

const gallery = (lookId: string) =>
  renderHook(() => useLookGallery(lookId), { wrapper }).result;

beforeEach(() => {
  window.localStorage.clear();
  resetScenePackStore();
  resetMemberSceneStore();
  setSceneRenderingAvailableForTesting(true);
  act(() => setGraphLook(DEFAULT_GRAPH_LOOK_ID));
});

afterEach(() => {
  setSceneRenderingAvailableForTesting(undefined);
});

describe('the looks either side', () => {
  it('are the walk’s neighbours, wrapping at both ends as the arrows do', () => {
    const ids = getLookWalk().map((look) => look.id);
    const first = gallery(ids[0]).current;
    expect(first.index).toBe(0);
    expect(first.count).toBe(ids.length);
    expect(first.previous?.id).toBe(ids[ids.length - 1]);
    expect(first.next?.id).toBe(ids[1]);

    const last = gallery(ids[ids.length - 1]).current;
    expect(last.next?.id).toBe(ids[0]);
    expect(last.previous?.id).toBe(ids[ids.length - 2]);
  });

  it('start from the walk’s first look when the one shown is out of it, as Space does', () => {
    const ids = getLookWalk().map((look) => look.id);
    const out = gallery('premium:not-here').current;
    expect(out.index).toBe(-1);
    expect(out.next?.id).toBe(ids[1]);
    expect(out.previous?.id).toBe(ids[ids.length - 1]);
  });
});

describe('the heart on the credit', () => {
  it('thanks FluidEQ for one of its own scenes', () => {
    act(() => adoptScenePackListingForTesting({ packs: [AURORA], locked: [] }));
    const { current } = gallery('premium:aurora').current;
    expect(current?.name).toBe('Aurora');
    expect(current?.byline).toBe('FluidEQ');
    expect(current?.liked).toEqual({
      lookId: 'premium:aurora',
      names: AURORA.names,
      own: false,
      authorName: 'FluidEQ',
    });
  });

  it('thanks the member who made a member’s scene, and is their own count on their own', () => {
    act(() =>
      adoptMemberSceneListingForTesting({
        scenes: [memberScene(false)],
        locked: [],
      }),
    );
    const theirs = gallery(`member:${AUTHOR}:cat`).current.current;
    expect(theirs?.byline).toBe('Rosa');
    expect(theirs?.liked).toMatchObject({ own: false, authorName: 'Rosa' });

    act(() => resetMemberSceneStore());
    act(() =>
      adoptMemberSceneListingForTesting({
        scenes: [memberScene(true)],
        locked: [],
      }),
    );
    const mine = gallery(`member:${AUTHOR}:cat`).current.current;
    expect(mine?.liked).toMatchObject({ own: true });
  });

  it('is on no standard look', () => {
    const { current } = gallery(DEFAULT_GRAPH_LOOK_ID).current;
    // The control: the look is on the credit, by its own name.
    expect(current?.id).toBe(DEFAULT_GRAPH_LOOK_ID);
    expect(current?.name).toBeTruthy();
    expect(current?.liked).toBeUndefined();
  });

  it('stays on a FluidEQ scene this computer has set aside, which is still the account’s', () => {
    act(() => adoptScenePackListingForTesting({ packs: [AURORA], locked: [] }));
    // Drawn nowhere here: out of the walk, still in the account's listing.
    setSceneRenderingAvailableForTesting(false);
    act(() => adoptScenePackListingForTesting({ packs: [AURORA], locked: [] }));
    const shown = gallery('premium:aurora').current;
    expect(shown.index).toBe(-1);
    expect(shown.current?.name).toBe('Aurora');
    expect(shown.current?.liked).toMatchObject({ lookId: 'premium:aurora' });
  });
});
