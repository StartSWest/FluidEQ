/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Plus tab reopens on the place it was left on — the Visualizers, the
 * leaderboard, the Studio or the lighting — after the window reloads, instead
 * of always on the Visualizers.
 */

import type * as TestingLibrary from '@testing-library/react';

type TNavigation = typeof import('../../../renderer/plus/plusNavigation');

let library: typeof TestingLibrary | undefined;

afterEach(() => {
  library?.cleanup();
  library = undefined;
  window.localStorage.clear();
});

/** The navigation as a freshly loaded window has it. */
const reload = () => {
  let navigation: TNavigation | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh module is the reload */
    library = require('@testing-library/react/pure');
    navigation = require('../../../renderer/plus/plusNavigation');
    /* eslint-enable global-require */
  });
  if (!navigation || !library) {
    throw new Error('plusNavigation did not load');
  }
  const { usePlusNavigation } = navigation;
  const view = library.renderHook(() => usePlusNavigation());
  return {
    navigation,
    place: () => view.result.current.place,
    act: library.act,
  };
};

describe('the place the Plus tab reopens on', () => {
  it('is the Visualizers for somebody who never chose one', () => {
    expect(reload().place()).toBe('visualizers');
  });

  it.each(['board', 'studio', 'lighting', 'visualizers'] as const)(
    'is %s after it was the last one opened',
    (place) => {
      const first = reload();
      first.act(() => first.navigation.openPlusPlace('studio'));
      first.act(() => first.navigation.openPlusPlace(place));
      expect(first.place()).toBe(place);
      library?.cleanup();

      expect(reload().place()).toBe(place);
    },
  );

  it('is the Visualizers when a scene page sent the member there last', () => {
    const first = reload();
    first.act(() => first.navigation.openPlusPlace('studio'));
    first.act(() => first.navigation.openGalleryPage({ kind: 'mine' }));
    library?.cleanup();

    expect(reload().place()).toBe('visualizers');
  });

  it('ignores a remembered value that is not a place', () => {
    window.localStorage.setItem('fluideq.plusPlace', 'channels');
    expect(reload().place()).toBe('visualizers');
  });
});
