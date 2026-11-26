/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The EQ page's Preset tab, on the two things that read as blinking.
 *
 * Every tile was disabled while a preset was being put on, so the disabled
 * opacity dimmed the whole grid at each press and brought it back (Ivan,
 * 2026-11-17); `apply` counts its presses and only the last one lands, so no
 * guard is needed. And the notes beside the grid swapped at every tile a
 * pointer ran over (2026-11-18): a preset only pointed at now waits half a
 * second in its body's own animation delay (`is-pointed`), and moving on
 * keys a new body, which starts the wait again.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render } from '@testing-library/react';
import EqPresetTab from 'renderer/eq/EqPresetTab';
import { setEqPresetQuery } from 'renderer/eq/eqLayerTab';
import { compileStylesheet, styleRules } from '__tests__/utils/stylesheetRules';

const mockApply = jest.fn(() => Promise.resolve());
const mockShell = { isEnabled: true, isBlockingError: false };

// A preset forever being put on: the state that used to disable every tile.
jest.mock('renderer/dsp/useDspPresetSelection', () => ({
  useDspPresetSelection: () => ({ apply: mockApply, selecting: true }),
}));
jest.mock('renderer/utils/FluidEqContext', () => ({
  ...jest.requireActual('renderer/utils/FluidEqContext'),
  ...jest
    .requireActual('__tests__/utils/fluidEqHookMocks')
    .eqHooksFrom(() => ({ ...mockShell, voicing: undefined })),
}));
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  ...jest.requireActual('renderer/utils/useAudioEngineStatus'),
  useKnownAudioEngineStatus: () => undefined,
}));
jest.mock('renderer/games/useGameSound', () => ({
  ...jest.requireActual('renderer/games/useGameSound'),
  useSoundingGame: () => undefined,
}));
// The cards' curves read how the graph draws the Preset layer, which asks
// main for the treble choice and the output's rate; with no bridge here they
// are drawn as before either is known, which is what the window does too.
jest.mock('renderer/utils/useTrebleDesigns', () => ({
  ...jest.requireActual('renderer/utils/useTrebleDesigns'),
  useTrebleDesigns: () => undefined,
}));
jest.mock('renderer/utils/useOutputRate', () => () => undefined);

const tiles = () =>
  Array.from(
    document.querySelectorAll<HTMLButtonElement>('.eq-preset-tab__tile'),
  );
const body = () => document.querySelector('.eq-preset-tab__detail-body');

beforeEach(() => {
  mockApply.mockClear();
  mockShell.isEnabled = true;
  mockShell.isBlockingError = false;
  act(() => setEqPresetQuery(''));
});

describe('the tiles while a preset is being put on', () => {
  it('stay pressable, and every press is handed on', () => {
    render(<EqPresetTab />);
    expect(tiles().length).toBeGreaterThan(1);
    tiles().forEach((tile) => expect(tile).toBeEnabled());
    // A second press before the first has landed is not refused here:
    // `apply` itself lets only the last one land.
    fireEvent.click(tiles()[0]);
    fireEvent.click(tiles()[1]);
    expect(mockApply).toHaveBeenCalledTimes(2);
  });

  it('POSITIVE CONTROL: are disabled with the equaliser off', () => {
    mockShell.isEnabled = false;
    render(<EqPresetTab />);
    expect(tiles().length).toBeGreaterThan(1);
    tiles().forEach((tile) => expect(tile).toBeDisabled());
  });
});

describe('the notes of a preset pointed at', () => {
  it('wait while it is only pointed at, and start again on the next one', () => {
    render(<EqPresetTab />);
    // Nothing pointed at: the playing preset's notes, not held.
    expect(body()).not.toHaveClass('is-pointed');
    const [first, second] = tiles();
    fireEvent.pointerEnter(first);
    const held = body();
    expect(held).toHaveClass('is-pointed');
    // Moving on is a new body, so its animation, and the wait, start again.
    fireEvent.pointerEnter(second);
    expect(body()).toHaveClass('is-pointed');
    expect(body()).not.toBe(held);
    // The pointer gone from the grid: back to the playing one, not held.
    const grid = document.querySelector('.eq-preset-tab__grid');
    if (!grid) {
      throw new Error('the Preset tab drew no grid');
    }
    fireEvent.pointerLeave(grid);
    expect(body()).not.toHaveClass('is-pointed');
  });

  it('hold back by half a second in the stylesheet, the wait kept under reduced motion', () => {
    const rules = styleRules(compileStylesheet('EqLayers.scss'));
    const pointed = (inReducedMotion: boolean) =>
      rules.filter(
        ({ selectors, within }) =>
          selectors.includes('.eq-preset-tab__detail-body.is-pointed') &&
          within.some((query) => query.includes('reduced-motion')) ===
            inReducedMotion,
      );
    expect(
      pointed(false).map(({ declarations }) =>
        declarations.get('animation-delay'),
      ),
    ).toContain('500ms');
    // Under reduced motion the fade goes and the wait stays.
    const reduced = pointed(true).map(({ declarations }) =>
      declarations.get('animation'),
    );
    expect(reduced.some((animation) => animation?.includes('500ms'))).toBe(
      true,
    );
    // POSITIVE CONTROL: the body itself fades in at once, with no wait.
    const plain = rules.find(
      ({ selectors, within }) =>
        selectors.includes('.eq-preset-tab__detail-body') &&
        within.length === 0 &&
        selectors.length === 1,
    );
    expect(plain?.declarations.get('animation')).toMatch(/eq-preset-detail-in/);
    expect(plain?.declarations.get('animation')).not.toContain('500ms');
  });
});
