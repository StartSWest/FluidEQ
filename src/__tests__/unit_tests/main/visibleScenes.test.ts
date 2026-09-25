/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which member scenes an account may see, and which of them it may draw.
 *
 * These rules decide whether one member's work can reach another member's
 * window, so they are asked here directly rather than only through the IPC
 * that calls them. Two of them are the whole of the answer: a scene stored as
 * somebody's own belongs to that account and to nobody else on the computer,
 * and a scene may be loaded only while the membership that may draw it is
 * live — checked at the load and not merely when the list was built, because
 * a page holds ids across the moment a membership ends.
 */

import { memberLookId } from '../../../common/memberScenes';
import type { IScenePack } from '../../../common/scenePacks';
import {
  loadVisibleScene,
  sceneListing,
  visibleScenes,
  type ISceneViewer,
} from '../../../main/memberScenes/visibleScenes';
import type {
  IMemberSceneStore,
  IMemberSceneSummary,
} from '../../../main/memberScenes/store';

const ME = '11111111-1111-4111-8111-111111111111';
const SOMEBODY = '22222222-2222-4222-8222-222222222222';
const ME_LOOK = memberLookId(ME, 'one');

const scene = (over: Partial<IMemberSceneSummary>): IMemberSceneSummary =>
  ({
    lookId: memberLookId(over.authorId ?? ME, over.packId ?? 'one'),
    authorId: ME,
    packId: 'one',
    version: 1,
    names: { en: 'One' },
    fallbackStyle: 'bars',
    swatch: ['#112233'],
    own: true,
    ...over,
  }) as IMemberSceneSummary;

const pack = (packId: string): IScenePack =>
  ({ id: packId, version: 1 }) as IScenePack;

interface IFakeStore {
  store: IMemberSceneStore;
  loads: Array<[string, string]>;
}

const storeOf = (scenes: IMemberSceneSummary[]): IFakeStore => {
  const loads: Array<[string, string]> = [];
  const store = {
    list: () => scenes,
    load: (authorId: string, packId: string) => {
      loads.push([authorId, packId]);
      return pack(packId);
    },
  } as unknown as IMemberSceneStore;
  return { store, loads };
};

const viewerOf = (accountId: string | undefined, entitled: boolean) =>
  ({ accountId: () => accountId, entitled: () => entitled }) as ISceneViewer;

describe('which member scenes an account may see', () => {
  it('lists the account its own scenes', () => {
    const { store } = storeOf([scene({})]);
    expect(visibleScenes(store, viewerOf(ME, true))).toHaveLength(1);
  });

  it('lists what another member sent, whoever sent it', () => {
    const { store } = storeOf([
      scene({ authorId: SOMEBODY, packId: 'sent', own: false }),
    ]);
    const seen = visibleScenes(store, viewerOf(ME, true));
    expect(seen.map((one) => one.packId)).toEqual(['sent']);
  });

  it('hides a scene another account on this computer made', () => {
    // Stored as somebody's own work, and this is not them. Two accounts
    // sharing a machine do not share what they are building.
    const { store } = storeOf([scene({ authorId: SOMEBODY, own: true })]);
    expect(visibleScenes(store, viewerOf(ME, true))).toEqual([]);
  });

  it('shows nobody anything while no account is signed in', () => {
    const { store } = storeOf([scene({}), scene({ packId: 'two' })]);
    expect(visibleScenes(store, viewerOf(undefined, true))).toEqual([]);
  });
});

describe('the listing the page is drawn from', () => {
  it('carries the scenes while the membership is live', () => {
    const { store } = storeOf([scene({})]);
    const listing = sceneListing(store, viewerOf(ME, true));
    expect(listing.entitled).toBe(true);
    expect(listing.scenes).toHaveLength(1);
    expect(listing.locked).toEqual([]);
  });

  it('locks the same scenes rather than losing them when Plus is off', () => {
    const { store } = storeOf([scene({}), scene({ packId: 'two' })]);
    const listing = sceneListing(store, viewerOf(ME, false));
    expect(listing.entitled).toBe(false);
    expect(listing.scenes).toEqual([]);
    expect(listing.locked.map((one) => one.packId)).toEqual(['one', 'two']);
  });

  it('answers afresh when the membership changes under it', () => {
    const { store } = storeOf([scene({})]);
    let live = false;
    const viewer = {
      accountId: () => ME,
      entitled: () => live,
    } as ISceneViewer;
    expect(sceneListing(store, viewer).entitled).toBe(false);
    live = true;
    expect(sceneListing(store, viewer).entitled).toBe(true);
  });
});

describe('loading the pack behind a look id', () => {
  it('hands over a scene this account may see', () => {
    const { store, loads } = storeOf([scene({})]);
    const loaded = loadVisibleScene(store, viewerOf(ME, true), ME_LOOK);
    expect(loaded?.pack.id).toBe('one');
    expect(loads).toEqual([[ME, 'one']]);
  });

  it('refuses once the membership has ended, for an id the page kept', () => {
    // The list is rebuilt when Plus goes, but a page holding an id from
    // before must not be able to ask for the scene itself.
    const { store, loads } = storeOf([scene({})]);
    expect(
      loadVisibleScene(store, viewerOf(ME, false), ME_LOOK),
    ).toBeUndefined();
    expect(loads).toEqual([]);
  });

  it('refuses a scene another account on this computer made', () => {
    const { store, loads } = storeOf([
      scene({ authorId: SOMEBODY, own: true }),
    ]);
    const theirs = memberLookId(SOMEBODY, 'one');
    expect(loadVisibleScene(store, viewerOf(ME, true), theirs)).toBeUndefined();
    // Never asked for: the refusal is the rule, not a missing file.
    expect(loads).toEqual([]);
  });

  it('refuses a look id for a scene that is not held at all', () => {
    const { store, loads } = storeOf([]);
    expect(
      loadVisibleScene(store, viewerOf(ME, true), ME_LOOK),
    ).toBeUndefined();
    expect(loads).toEqual([]);
  });

  it('refuses anything that is not a member look id', () => {
    const { store } = storeOf([scene({})]);
    const viewer = viewerOf(ME, true);
    expect(loadVisibleScene(store, viewer, undefined)).toBeUndefined();
    expect(loadVisibleScene(store, viewer, 42)).toBeUndefined();
    expect(loadVisibleScene(store, viewer, 'aurora')).toBeUndefined();
    expect(loadVisibleScene(store, viewer, `${ME}:one`)).toBeUndefined();
  });

  it('refuses a look id whose author is not an account id', () => {
    const { store } = storeOf([scene({})]);
    expect(
      loadVisibleScene(store, viewerOf(ME, true), 'member:../../etc:one'),
    ).toBeUndefined();
  });
});
