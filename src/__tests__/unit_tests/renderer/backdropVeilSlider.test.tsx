/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Transparency is live only while a Backdrop is drawn: the Backdrop chosen
 * and a Plus visualizer to draw in it. The mode is remembered across looks,
 * and on it alone the slider stayed live under a standard visualizer, with
 * nothing behind the window to see through to (2026-09-26).
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import BackdropVeilSlider from '../../../renderer/graph/BackdropVeilSlider';

const state = { mode: 'cover', lookId: 'premium:bloom' };

jest.mock('../../../renderer/utils/sceneTintStore', () => ({
  useSceneTintMode: () => state.mode,
}));
jest.mock('../../../renderer/utils/graphStyle', () => ({
  useSelectedLookId: () => state.lookId,
}));
jest.mock('../../../renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const slider = () => {
  render(<BackdropVeilSlider />);
  return screen.getByRole('slider', { name: 'graph.backdropVeil' });
};

describe('the Transparency slider', () => {
  it('is live under the Backdrop with a Plus visualizer drawn in it', () => {
    // The control: the case where it has something to do.
    expect(slider()).toBeEnabled();
  });

  it('is off under the Backdrop with a standard visualizer', () => {
    state.lookId = 'look:signal';
    expect(slider()).toBeDisabled();
  });

  it('is off in every other mode', () => {
    state.lookId = 'premium:bloom';
    state.mode = 'pulse';
    expect(slider()).toBeDisabled();
  });
});
