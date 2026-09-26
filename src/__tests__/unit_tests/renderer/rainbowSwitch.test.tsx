/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Normal or Rainbow, under Brightness and Transparency (Ivan, 2026-09-26:
 * "let's keep the normal mode and the rainbow mode"). On by default.
 */

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import en from 'common/i18n/en';
import RainbowSwitch from 'renderer/graph/RainbowSwitch';
import {
  isEuphoriaEnabled,
  resetEuphoriaMode,
} from 'renderer/utils/euphoriaMode';

beforeEach(() => resetEuphoriaMode());

describe('the Rainbow mode switch', () => {
  it('starts on, and turns the mode off and on again', () => {
    render(<RainbowSwitch />);
    const toggle = screen.getByRole('checkbox', {
      name: en['graph.sceneTint.rainbow'],
    });
    expect(toggle).toBeChecked();
    expect(isEuphoriaEnabled()).toBe(true);

    fireEvent.click(toggle);
    expect(isEuphoriaEnabled()).toBe(false);
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(isEuphoriaEnabled()).toBe(true);
  });
});
