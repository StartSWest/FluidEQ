/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The amp has no window-colour modes: with a Plus visualizer it is always
 * the Backdrop, and the full app keeps the mode chosen for it (Ivan,
 * 2026-10-25: "let's remove colour modes, always backdrop only on the amp
 * ui, don't touch the full app").
 */

import type * as TestingLibrary from '@testing-library/react';

const look = { id: 'premium:bloom' };

jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => look.id,
}));

type TStore = typeof import('../../../renderer/utils/sceneTintStore');

let library: typeof TestingLibrary | undefined;

afterEach(() => {
  library?.cleanup();
  library = undefined;
  window.localStorage.clear();
  look.id = 'premium:bloom';
});

/** The store and the Backdrop question, loaded after the app's mode is stored. */
const launch = (appMode: string) => {
  window.localStorage.setItem('fluideq.sceneTintMode', appMode);
  let store: TStore | undefined;
  let useIsBackdrop: (() => boolean) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require, @typescript-eslint/no-require-imports -- one registry, React included, per launch */
    library = require('@testing-library/react/pure');
    store = require('../../../renderer/utils/sceneTintStore');
    useIsBackdrop = require('../../../renderer/utils/useIsBackdrop').default;
    /* eslint-enable global-require, @typescript-eslint/no-require-imports */
  });
  if (!store || !useIsBackdrop || !library) {
    throw new Error('the tint modules did not load');
  }
  return { store, useIsBackdrop, library };
};

describe('the amp’s window colours', () => {
  it('are the Backdrop while the amp holds the window, and the app’s own mode when it lets go', () => {
    const { store, library: fresh } = launch('tint');
    const { result } = fresh.renderHook(() => store.useWindowTintMode());
    // The control: the full app wears the mode chosen for it.
    expect(result.current).toBe('tint');
    fresh.act(() => store.setAmpHoldsWindow(true));
    expect(result.current).toBe('cover');
    fresh.act(() => store.setAmpHoldsWindow(false));
    expect(result.current).toBe('tint');
    // Never written down: the app's choice is the one it stored.
    expect(window.localStorage.getItem('fluideq.sceneTintMode')).toBe('tint');
  });

  it('put a Plus visualizer behind the amp’s panes whatever mode the app is in', () => {
    const { store, useIsBackdrop, library: fresh } = launch('off');
    const { result } = fresh.renderHook(() => useIsBackdrop());
    expect(result.current).toBe(false);
    fresh.act(() => store.setAmpHoldsWindow(true));
    expect(result.current).toBe(true);
  });

  it('leave a standard visualizer without a Backdrop in the amp too', () => {
    look.id = 'look:signal';
    const { store, useIsBackdrop, library: fresh } = launch('cover');
    const { result } = fresh.renderHook(() => useIsBackdrop());
    fresh.act(() => store.setAmpHoldsWindow(true));
    expect(result.current).toBe(false);
  });
});
