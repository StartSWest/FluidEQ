/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Transparency is live whenever a Plus visualizer is chosen, the only look
 * with a picture to show through the panes, and dimmed with a standard one
 * (Ivan, 2026-11-16: "instead of having a backdrop mode is just transparency
 * and blur"). The window's colour mode no longer decides it: there is no
 * Backdrop mode, and the full app's Backdrop was taken out the same day, so
 * what is left is the amp's glass.
 */

import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import BackdropVeilSlider from '../../../renderer/graph/BackdropVeilSlider';

const state = { lookId: 'premium:bloom' };

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

beforeEach(() => {
  window.localStorage.clear();
  state.lookId = 'premium:bloom';
});

describe('the Transparency slider', () => {
  it('is live with a Plus visualizer, whatever the window’s colours', () => {
    window.localStorage.setItem('fluideq.sceneTintMode', 'pulse');
    expect(slider()).toBeEnabled();
  });

  // The control: nothing behind the panes to see through to.
  it('is off with a standard visualizer', () => {
    state.lookId = 'look:signal';
    expect(slider()).toBeDisabled();
  });
});
