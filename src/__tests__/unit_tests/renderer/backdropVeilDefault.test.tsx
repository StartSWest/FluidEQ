/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where Transparency opens with nothing stored: half way, in the app and in
 * the amp alike (Ivan, 2026-09-28: "transparent default to 50 when app
 * install"). The app opened at 5% and the amp at 45% before.
 *
 * The store reads storage once, as it loads, so each case loads its own copy,
 * and the testing library with it so both share one React.
 */

import type * as TestingLibrary from '@testing-library/react';

type TVeil = typeof import('../../../renderer/utils/backdropVeil');

let library: typeof TestingLibrary | undefined;

/** The slider's value in the app and then in the amp, from a fresh store. */
const opened = () => {
  let veil: TVeil | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh copy per case, read as it loads */
    library = require('@testing-library/react/pure');
    veil = require('../../../renderer/utils/backdropVeil');
    /* eslint-enable global-require */
  });
  if (!veil || !library) {
    throw new Error('the veil store did not load');
  }
  const store = veil;
  const { result } = library.renderHook(() => store.useBackdropVeil());
  const app = result.current;
  library.act(() => store.applyBackdropVeilScope('player'));
  return { app, player: result.current };
};

afterEach(() => {
  library?.cleanup();
  library = undefined;
  window.localStorage.clear();
});

describe('Transparency on a fresh install', () => {
  it('opens half way in the app and in the amp', () => {
    expect(opened()).toEqual({ app: 50, player: 50 });
  });

  // POSITIVE CONTROL: a choice that was made is what opens, each window its
  // own, so the case above is the default and not a value read back.
  it('opens where each window was left once it has been moved', () => {
    window.localStorage.setItem('fluideq.backdropVeil', '80');
    window.localStorage.setItem('fluideq.backdropVeil.player', '30');
    expect(opened()).toEqual({ app: 80, player: 30 });
  });
});
