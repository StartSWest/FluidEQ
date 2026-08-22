/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { fireEvent, render, screen, within } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import { DSP_DEFAULTS, IDspSettings } from '../../common/dsp/chain';
import { DSP_PRESETS } from '../../common/dsp/presets';
import { FluidEqProviderWrapper } from '../../renderer/utils/FluidEqContext';
import DspPanel from '../../renderer/dsp/DspPanel';
import { TDspEngineState } from '../../renderer/dsp/store';

/**
 * Wrapped in the FluidEQ provider because the faders are the equaliser's own
 * `Slider`, which reads `isBlockingError` from it to decide whether it may be
 * dragged at all.
 */
const renderPanel = (
  settings: IDspSettings = DSP_DEFAULTS,
  engineState: TDspEngineState = 'running',
) => {
  const onChange = jest.fn();
  const onCommit = jest.fn();
  render(
    <FluidEqProviderWrapper
      value={{ ...defaultFluidEqContext, isEnabled: true }}
    >
      <DspPanel
        settings={settings}
        onChange={onChange}
        onCommit={onCommit}
        engineState={engineState}
      />
    </FluidEqProviderWrapper>,
  );
  return { onChange, onCommit };
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

  /**
   * The rail names every processor even though only one is on screen.
   *
   * Stacking them put four cards and forty-one knobs in front of someone who
   * wanted to move one. The chain still has to be readable as a chain, so the
   * rail carries all four names whichever page is open.
   */
  it('names every processor on the rail', () => {
    renderPanel();
    // Scoped to the rail: the band picker inside the EQ page is also labelled
    // "Equaliser", and a document-wide query matches both.
    const rail = within(screen.getByRole('navigation', { name: 'DSP' }));
    ['Equaliser', 'Exciter', 'Multiband compressor', 'Maximizer'].forEach(
      (name) => {
        expect(
          rail.getByRole('button', { name: new RegExp(name, 'i') }),
        ).toBeInTheDocument();
      },
    );
  });

  /**
   * Identified by its band picker rather than by a description.
   *
   * The EQ page carries no description line: a graph you drag explains itself,
   * and a paragraph above it was only taking the room the graph wanted.
   */
  it('opens on the equaliser', () => {
    renderPanel();
    expect(screen.getByRole('tablist', { name: /bands/i })).toBeInTheDocument();
    expect(screen.queryByText(/invents them/i)).not.toBeInTheDocument();
  });

  it('says the exciter invents its harmonics once its page is open', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Exciter/i }));
    expect(screen.getByText(/invents them/i)).toBeInTheDocument();
  });

  it('applies a preset whole when one is chosen', () => {
    const { onChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Repair compressed/i }));
    const repair = DSP_PRESETS.find((preset) => preset.id === 'lossy-repair');
    expect(onChange).toHaveBeenCalledWith(repair?.settings);
  });

  it('toggles a processor without disturbing the others', () => {
    const { onChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Exciter/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exciter' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.exciter.enabled).toBe(true);
    expect(next.eq.enabled).toBe(false);
    expect(next.compressor.enabled).toBe(false);
    expect(next.maximizer.enabled).toBe(false);
  });

  it('stays quiet about the engine while it is running', () => {
    renderPanel();
    expect(screen.queryByText(/could not start/i)).not.toBeInTheDocument();
  });

  it('POSITIVE CONTROL: says so when the engine genuinely failed', () => {
    renderPanel(DSP_DEFAULTS, 'failed');
    expect(screen.getByText(/could not start/i)).toBeInTheDocument();
  });

  /**
   * The bug this whole distinction exists for.
   *
   * The engine lives in LibraryPlayerProvider, which does not mount until the
   * Library has been opened. Opening the DSP tab first left it genuinely
   * unstarted — and the two-state version reported that as a failure, telling
   * people audio processing could not start on a machine that was fine.
   */
  it('does NOT claim a failure when the engine has simply not started', () => {
    renderPanel(DSP_DEFAULTS, 'idle');
    expect(screen.queryByText(/could not start/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/play something from the Library/i),
    ).toBeInTheDocument();
  });

  it('shows the three compressor bands on the compressor page', () => {
    renderPanel();
    fireEvent.click(
      screen.getByRole('button', { name: /Multiband compressor/i }),
    );
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Mid')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });

  /**
   * One page at a time is the whole point of the rail.
   *
   * If two processors could be on screen together the stacking is back, and
   * with it the wall of dials this replaced.
   */
  it('shows one processor at a time', () => {
    renderPanel();
    fireEvent.click(
      screen.getByRole('button', { name: /Multiband compressor/i }),
    );
    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.queryByText(/invents them/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Six parametric bands/i)).not.toBeInTheDocument();
  });
});
