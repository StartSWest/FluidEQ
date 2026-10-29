/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which version of each Plus look this computer last played, which is what
 * the picker's "New" and the graph's one-time notice are decided from. What
 * is held here: a look never played is never new; a newer version is new until
 * it is played; the answer survives a restart; and a damaged record is read as
 * nothing rather than as a crash.
 */

import type * as SeenSceneVersions from '../../../renderer/utils/seenSceneVersions';
import { resetSettings } from '../../../renderer/utils/settingsReset';

const KEY = 'fluideq.seenSceneVersions';

/** A fresh copy of the store, reading localStorage as a restart would. */
const load = () => {
  let store: typeof SeenSceneVersions | undefined;
  jest.isolateModules(() => {
    store = jest.requireActual('../../../renderer/utils/seenSceneVersions');
  });
  return (): typeof SeenSceneVersions => {
    if (!store) {
      throw new Error('the store did not load');
    }
    return store;
  };
};

beforeEach(() => {
  localStorage.clear();
});

it('never calls a look new that was never played here', () => {
  const store = load()();
  expect(store.isUnseenSceneVersion('premium:alpine', 49)).toBe(false);
  expect(store.markSceneVersionSeen('premium:alpine', 49)).toBeUndefined();
  expect(store.isUnseenSceneVersion('premium:alpine', 49)).toBe(false);
});

it('calls a newer version new until it is played, and says what was played before', () => {
  const store = load()();
  store.markSceneVersionSeen('premium:alpine', 47);
  expect(store.isUnseenSceneVersion('premium:alpine', 49)).toBe(true);
  // The control: the same version and an older one are not new.
  expect(store.isUnseenSceneVersion('premium:alpine', 47)).toBe(false);
  expect(store.isUnseenSceneVersion('premium:alpine', 46)).toBe(false);
  expect(store.isUnseenSceneVersion('premium:alpine', undefined)).toBe(false);

  expect(store.markSceneVersionSeen('premium:alpine', 49)).toBe(47);
  expect(store.isUnseenSceneVersion('premium:alpine', 49)).toBe(false);
  // Played again at the same version: nothing to tell.
  expect(store.markSceneVersionSeen('premium:alpine', 49)).toBeUndefined();
});

it('remembers across a restart', () => {
  load()().markSceneVersionSeen('premium:aurora', 4);
  const again = load()();
  expect(again.seenSceneVersion('premium:aurora')).toBe(4);
  expect(again.isUnseenSceneVersion('premium:aurora', 5)).toBe(true);
});

it('persists version 11 through reload, reinstall and reset while keeping scenes independent', () => {
  const first = load()();
  first.markSceneVersionSeen('premium:neon-horizon', 10);
  expect(first.markSceneVersionSeen('premium:neon-horizon', 11)).toBe(10);
  localStorage.setItem('fluideq.theme', 'stored');
  resetSettings(localStorage);
  expect(localStorage.getItem('fluideq.theme')).toBeNull();
  // A reinstall, cache refresh or renderer restart reloads the same stable
  // look id and normalized pack version, not a download/revision timestamp.
  const restarted = load()();
  expect(
    restarted.markSceneVersionSeen('premium:neon-horizon', 11),
  ).toBeUndefined();
  expect(
    restarted.markSceneVersionSeen('premium:neon-horizon', 10),
  ).toBeUndefined();
  expect(
    restarted.markSceneVersionSeen('premium:neon-horizon', 11),
  ).toBeUndefined();
  expect(restarted.markSceneVersionSeen('premium:neon-horizon', 12)).toBe(11);
  restarted.markSceneVersionSeen('premium:another-scene', 10);
  expect(restarted.markSceneVersionSeen('premium:another-scene', 11)).toBe(10);
});

it('reads a damaged record as nothing played, and keeps only sensible entries', () => {
  localStorage.setItem(KEY, '{ not json');
  expect(load()().seenSceneVersion('premium:alpine')).toBeUndefined();

  localStorage.setItem(
    KEY,
    JSON.stringify({
      'premium:alpine': 47,
      'premium:bloom': -1,
      'premium:coral': 2.5,
      'premium:ember': '3',
      ['x'.repeat(201)]: 4,
    }),
  );
  const store = load()();
  expect(store.seenSceneVersion('premium:alpine')).toBe(47);
  expect(store.seenSceneVersion('premium:bloom')).toBeUndefined();
  expect(store.seenSceneVersion('premium:coral')).toBeUndefined();
  expect(store.seenSceneVersion('premium:ember')).toBeUndefined();
});

it('keeps the most recently played looks when it runs out of room', () => {
  const store = load()();
  for (let index = 0; index < 205; index += 1) {
    store.markSceneVersionSeen(`member:look-${index}`, 1);
  }
  const again = load()();
  expect(again.seenSceneVersion('member:look-0')).toBeUndefined();
  expect(again.seenSceneVersion('member:look-204')).toBe(1);
});

// An owner going back to an earlier version they kept, and then to the newest
// again, has seen nothing new: the highest version played is what is kept.
it('is not lowered by an earlier version played, and announces nothing on the way back', () => {
  const store = load()();
  store.markSceneVersionSeen('premium:alpine', 49);
  expect(store.markSceneVersionSeen('premium:alpine', 46)).toBeUndefined();
  expect(store.seenSceneVersion('premium:alpine')).toBe(49);
  expect(store.isUnseenSceneVersion('premium:alpine', 49)).toBe(false);
  expect(store.markSceneVersionSeen('premium:alpine', 49)).toBeUndefined();
  // The control: a version newer than the highest is still news.
  expect(store.markSceneVersionSeen('premium:alpine', 50)).toBe(49);
});
