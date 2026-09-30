/**
 * Online Media's sites in the interface's colours: on in a new install (Ivan,
 * 2026-09-29: "color pages in online media also default on"), and off for
 * whoever turned them off, however many launches later.
 */

import type * as GuestTintPreference from 'renderer/video/guestTintPreference';

type TModule = typeof GuestTintPreference;

// The switch reads its choice once, when the module is first loaded: each
// launch here starts from the storage it is given and a fresh module. The
// page reads it through React's store hook; here the hook is the store's own
// reading, which is all it does with a value that has not changed.
const launch = (): TModule => {
  let loaded: TModule | undefined;
  jest.isolateModules(() => {
    jest.doMock('react', () => ({
      ...jest.requireActual('react'),
      useSyncExternalStore: (_subscribe: unknown, read: () => boolean) =>
        read(),
    }));
    // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports -- a fresh copy of the module per launch
    loaded = require('renderer/video/guestTintPreference') as TModule;
  });
  if (!loaded) {
    throw new Error('the preference did not load');
  }
  return loaded;
};

const KEY = 'fluideq.video.matchColours';

beforeEach(() => window.localStorage.clear());

describe('the Online Media colours switch', () => {
  it('is on in a new install', () => {
    expect(launch().useGuestTintEnabled()).toBe(true);
  });

  it('stays off for somebody who turned it off, launch after launch', () => {
    launch().setGuestTintEnabled(false);
    expect(window.localStorage.getItem(KEY)).toBe('false');
    expect(launch().useGuestTintEnabled()).toBe(false);
    expect(launch().useGuestTintEnabled()).toBe(false);
  });

  // The positive control for the case above: the same storage turned back on
  // reads as on, so "off" is the stored choice and not the switch stuck.
  it('stays on for somebody who turned it back on', () => {
    const first = launch();
    first.setGuestTintEnabled(false);
    first.setGuestTintEnabled(true);
    expect(launch().useGuestTintEnabled()).toBe(true);
  });
});
