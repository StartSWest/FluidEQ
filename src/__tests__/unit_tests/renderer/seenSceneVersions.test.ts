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
