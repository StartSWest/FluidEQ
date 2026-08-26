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
import {
  TDspEngineState,
  readDspOutputSafetyEnabled,
  setDspOutputSafetyEnabled,
  setDspSampleRate,
} from '../../renderer/dsp/store';

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
  const view = render(
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
  return { ...view, onChange, onCommit };
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

  it('offers an ephemeral final-safety A/B in development', () => {
    setDspOutputSafetyEnabled(true);
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Master/i }));
    const toggle = screen.getByRole('checkbox', { name: 'Safety A/B' });
    expect(toggle).toBeChecked();
    fireEvent.click(toggle);
    expect(readDspOutputSafetyEnabled()).toBe(false);
    expect(toggle).not.toBeChecked();
    setDspOutputSafetyEnabled(true);
  });

  it('shows the automatic system rate compactly in the DSP title', () => {
    setDspSampleRate(48_000);
    renderPanel();
    expect(
      screen.getByRole('heading', { name: /48 kHz/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/device bits/i)).not.toBeInTheDocument();
  });

  /**
   * Every preset gets a button, and the count is asserted so that adding one
   * without a name in the dictionary fails here rather than shipping a button
   * labelled with its own key.
   */
  it('offers every factory preset', () => {
    const { container } = renderPanel();
    const presets = within(
      container.querySelector('.dsp-presets') as HTMLElement,
    );
    ['Repair compressed', 'Loud', 'Broadcast'].forEach((name) => {
      expect(presets.getByRole('button', { name })).toBeInTheDocument();
    });
    expect(
      presets.queryByRole('button', { name: 'Off' }),
    ).not.toBeInTheDocument();
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
    [
      'Normalizer',
      'Crossfade',
      'Exciter',
      'Equaliser',
      'Maximizer',
      'Master',
    ].forEach((name) => {
      expect(
        rail.getByRole('button', { name: new RegExp(name, 'i') }),
      ).toBeInTheDocument();
    });
    expect(
      rail.queryByRole('button', { name: /Multiband compressor/i }),
    ).not.toBeInTheDocument();
  });

  /**
   * Identified by its band picker rather than by a description.
   *
   * The EQ page carries no description line: a graph you drag explains itself,
   * and a paragraph above it was only taking the room the graph wanted.
   */
  it('opens on the normalizer at the start of the processing chain', () => {
    renderPanel();
    expect(
      screen.getByRole('region', { name: /Normalizer/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('tablist', { name: /bands/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/invents them/i)).not.toBeInTheDocument();
  });

  /**
   * The page has to say the harmonics were never there.
   *
   * It is the one claim in this rack a user cannot check by listening —
   * everything else shapes what arrived, and this makes something up. The
   * wording moved when the page grew three bands and the organic stage, so
   * this asks for the CLAIM rather than for the old sentence.
   */
  it('says the exciter invents its harmonics once its page is open', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Exciter/i }));
    expect(screen.getByText(/never in the signal/i)).toBeInTheDocument();
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

  it('turns EQ Isolate off before bypassing the EQ', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Equaliser/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Equaliser' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.eq.enabled).toBe(false);
    expect(next.eq.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  it('turns Exciter Isolate off before bypassing the Exciter', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Exciter/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exciter' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.exciter.enabled).toBe(false);
    expect(next.exciter.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  it('turns EQ Isolate off before leaving the EQ view', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Equaliser/i }));
    fireEvent.click(screen.getByRole('button', { name: /Exciter/i }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.eq.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  it('turns Exciter Isolate off before leaving the Exciter view', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Exciter/i }));
    fireEvent.click(screen.getByRole('button', { name: /Maximizer/i }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.exciter.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  it('turns both monitor flags off when the DSP workspace closes', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, enabled: true, isolate: true },
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true, isolate: true },
    };
    const { unmount, onChange, onCommit } = renderPanel(active);
    unmount();
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.eq.isolate).toBe(false);
    expect(next.exciter.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
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

  /**
   * One page at a time is the whole point of the rail.
   *
   * If two processors could be on screen together the stacking is back, and
   * with it the wall of dials this replaced.
   */
  it('shows one processor at a time', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Maximizer/i }));
    expect(screen.getByText(/Raises the overall level/i)).toBeInTheDocument();
    expect(screen.queryByText(/invents them/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('tablist', { name: /bands/i }),
    ).not.toBeInTheDocument();
  });

  it('root-bypasses the chain without changing any processor state', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, enabled: true },
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true },
    };
    const { onChange, onCommit, unmount } = renderPanel(active);
    fireEvent.click(screen.getByRole('checkbox', { name: 'DSP' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.enabled).toBe(false);
    expect(next.eq.enabled).toBe(true);
    expect(next.exciter.enabled).toBe(true);
    expect(onCommit).toHaveBeenCalled();
    unmount();
    const { container } = renderPanel(next);
    expect(container.querySelector('.dsp-body')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
});
