/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The DSP EQ's Treble row: the main EQ's Precise and Classic, on the rack's
 * own EQ (`DspEqBar.tsx`).
 *
 * It is the listener's choice rather than a curve's, so changing it must not
 * call the curve Custom; and where the engine running the rack is too old to
 * play it, the row says so instead of offering a switch that changes nothing.
 */
import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { DSP_DEFAULTS, IEqSettings } from '../../../common/dsp/chain';
import type { IRackTrebleContext } from '../../../common/dsp/rackTreble';
import en from '../../../common/i18n/en';
import DspEqBar from '../../../renderer/dsp/DspEqBar';

let rackContext: IRackTrebleContext = {
  engine: 'fluid',
  libraryAudible: false,
  dllVersion: '1.16.0.0',
};

jest.mock('../../../renderer/dsp/useRackTreble', () => ({
  __esModule: true,
  default: () => rackContext,
}));

const rack: IEqSettings = { ...DSP_DEFAULTS.eq, presetId: 'rock' };

const treble = () =>
  screen.getByRole('radiogroup', { name: en['eq.mode.treble'] });

describe('the DSP EQ’s Treble row', () => {
  beforeEach(() => {
    localStorage.clear();
    rackContext = {
      engine: 'fluid',
      libraryAudible: false,
      dllVersion: '1.16.0.0',
    };
  });

  it('offers Precise and Classic, Precise chosen by default', () => {
    render(
      <DspEqBar
        eq={rack}
        sampleRate={48_000}
        onChange={jest.fn()}
        onCommit={jest.fn()}
      />,
    );
    const precise = within(treble()).getByRole('radio', {
      name: en['eq.mode.precise'],
    });
    const classic = within(treble()).getByRole('radio', {
      name: en['eq.mode.classic'],
    });
    expect(precise).toHaveAttribute('aria-checked', 'true');
    expect(classic).toHaveAttribute('aria-checked', 'false');
    expect(precise).toBeEnabled();
    expect(precise).toHaveAttribute('title', en['dsp.eqTreble.preciseHint']);
    expect(classic).toHaveAttribute('title', en['eq.mode.trebleEqClassic']);
  });

  it('switches to Classic without calling the curve Custom', () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    render(
      <DspEqBar
        eq={rack}
        sampleRate={48_000}
        onChange={onChange}
        onCommit={onCommit}
      />,
    );
    fireEvent.click(
      within(treble()).getByRole('radio', { name: en['eq.mode.classic'] }),
    );
    expect(onChange).toHaveBeenCalledWith({ ...rack, treble: 'classic' });
    // The preset keeps its name: the Treble is how the bands play, not a
    // part of the curve.
    expect(onChange.mock.calls[0][0].presetId).toBe('rock');
    expect(onCommit).toHaveBeenCalled();
  });

  it('says to update the engine where the rack runs on one too old for it', () => {
    rackContext = { ...rackContext, dllVersion: '1.15.0.0' };
    render(
      <DspEqBar
        eq={rack}
        sampleRate={48_000}
        onChange={jest.fn()}
        onCommit={jest.fn()}
      />,
    );
    within(treble())
      .getAllByRole('radio')
      .forEach((option) => {
        expect(option).toBeDisabled();
        expect(option).toHaveAttribute('title', en['eq.mode.trebleUpdate']);
      });
  });
});
