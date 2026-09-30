/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Pointer sparks, under Rainbow mode in Window colours: off on a new install
 * (Ivan, 2026-09-28: "sparks get disabled by default in new installation"),
 * on and off again at the switch, and kept for the next launch.
 *
 * The store reads storage once, as it loads, so each case loads its own copy,
 * and the testing library with it so both share one React.
 */

import type * as TestingLibrary from '@testing-library/react';
import en from 'common/i18n/en';

type TSwitch = typeof import('../../../renderer/graph/PointerSparksSwitch');

let library: typeof TestingLibrary | undefined;

/** The switch from a fresh store, as a new launch would draw it. */
const launched = () => {
  let module: TSwitch | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh copy per case, read as it loads */
    library = require('@testing-library/react/pure');
    module = require('../../../renderer/graph/PointerSparksSwitch');
    /* eslint-enable global-require */
  });
  if (!module || !library) {
    throw new Error('the sparks switch did not load');
  }
  const PointerSparksSwitch = module.default;
  library.render(<PointerSparksSwitch />);
  return library.screen.getByRole('checkbox', {
    name: en['graph.sceneTint.sparks'],
  }) as HTMLInputElement;
};

afterEach(() => {
  library?.cleanup();
  library = undefined;
  window.localStorage.clear();
});

describe('the Pointer sparks switch', () => {
  it('starts on in a new install', () => {
    expect(launched().checked).toBe(true);
  });

  it('turns them off and on, and keeps the choice for the next launch', () => {
    const toggle = launched();
    library?.fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    library?.cleanup();

    const next = launched();
    expect(next.checked).toBe(false);
    library?.fireEvent.click(next);
    expect(next.checked).toBe(true);
    expect(window.localStorage.getItem('fluideq.pointerSparks')).toBe('true');
  });
});
