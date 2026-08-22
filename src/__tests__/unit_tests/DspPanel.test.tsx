/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import { DSP_DEFAULTS, IDspSettings } from '../../common/dsp/chain';
import { DSP_PRESETS } from '../../common/dsp/presets';
import DspPanel from '../../renderer/dsp/DspPanel';

const renderPanel = (
  settings: IDspSettings = DSP_DEFAULTS,
  isActive = true,
) => {
  const onChange = jest.fn();
  render(
    <DspPanel settings={settings} onChange={onChange} isActive={isActive} />,
  );
  return onChange;
};

describe('DspPanel', () => {
  /**
   * The rule a test can check even though the ones it protects against cannot.
   *
   * Every other pill in the EQ group configures Equalizer APO and changes all
   * system audio; this one only touches FluidEQ's own player. Someone who
   * assumes otherwise reports the feature as broken, so the notice is visible
   * body text rather than a tooltip — and this asserts it is actually rendered
   * rather than merely written into the dictionary.
   */
  it('states its scope in visible text', () => {
    renderPanel();
    expect(screen.getByText(/does not change Spotify/i)).toBeInTheDocument();
  });

  it('offers every factory preset', () => {
    renderPanel();
    ['Off', 'Repair compressed', 'Loud'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    });
    expect(DSP_PRESETS).toHaveLength(3);
  });

  it('names all three processors', () => {
    renderPanel();
    expect(screen.getByText('Exciter')).toBeInTheDocument();
    expect(screen.getByText('Multiband compressor')).toBeInTheDocument();
    expect(screen.getByText('Maximizer')).toBeInTheDocument();
  });

  it('says the exciter invents its harmonics rather than recovering them', () => {
    renderPanel();
    expect(screen.getByText(/invents them/i)).toBeInTheDocument();
  });

  it('applies a preset whole when one is chosen', () => {
    const onChange = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Repair compressed/i }));
    const repair = DSP_PRESETS.find((preset) => preset.id === 'lossy-repair');
    expect(onChange).toHaveBeenCalledWith(repair?.settings);
  });

  it('toggles a processor without disturbing the others', () => {
    const onChange = renderPanel();
    // By role, not by label: the section heading carries the same text, and
    // `getByLabelText` matches both.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exciter' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.exciter.enabled).toBe(true);
    expect(next.compressor.enabled).toBe(false);
    expect(next.maximizer.enabled).toBe(false);
  });

  it('stays quiet about the engine while it is running', () => {
    renderPanel();
    expect(screen.queryByText(/could not start/i)).not.toBeInTheDocument();
  });

  it('POSITIVE CONTROL: says so when the engine could not start', () => {
    renderPanel(DSP_DEFAULTS, false);
    expect(screen.getByText(/could not start/i)).toBeInTheDocument();
  });

  it('shows the three compressor bands', () => {
    renderPanel();
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Mid')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});
