/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Colourful mode is always on and has no switch (Ivan, 2026-11-18: "let's
 * remove the Colourful mode from the top, there is no more of it: Colourful
 * mode is always on"). What is left of the module is forgetting what older
 * versions stored for the switch, and telling a component when the root
 * carries the look.
 */

import { act, renderHook } from '@testing-library/react';
import {
  forgetColourfulModeSwitch,
  useIsRootEuphoric,
} from 'renderer/utils/euphoriaMode';

const RETIRED = [
  'fluideq-euphoria-reached',
  'fluideq-euphoria-enabled',
  'fluideq-rainbow',
];

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove('is-euphoric');
});

describe('the switch that is gone', () => {
  it('forgets what every older version stored for it', () => {
    RETIRED.forEach((key) => window.localStorage.setItem(key, 'false'));
    window.localStorage.setItem('fluideq.windowTint', '200');
    forgetColourfulModeSwitch();
    RETIRED.forEach((key) =>
      expect(window.localStorage.getItem(key)).toBeNull(),
    );
    // The control: what the window still keeps is left alone.
    expect(window.localStorage.getItem('fluideq.windowTint')).toBe('200');
  });

  it('says nothing when storage cannot be reached', () => {
    const removeItem = jest
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('Storage is unavailable');
      });
    try {
      expect(() => forgetColourfulModeSwitch()).not.toThrow();
    } finally {
      removeItem.mockRestore();
    }
  });
});

describe('the look on the root', () => {
  it('follows the class as it arrives and leaves', async () => {
    const { result } = renderHook(() => useIsRootEuphoric());
    expect(result.current).toBe(false);
    await act(async () => {
      document.documentElement.classList.add('is-euphoric');
    });
    expect(result.current).toBe(true);
    await act(async () => {
      document.documentElement.classList.remove('is-euphoric');
    });
    expect(result.current).toBe(false);
  });
});
