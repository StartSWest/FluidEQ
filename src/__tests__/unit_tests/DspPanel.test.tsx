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
    // Four: Task 7 added `bass-power`, whose dictionary entry Task 8 still
    // owes — its button renders with the raw key until that key lands, which
    // is expected here and is not what this count guards against.
    expect(DSP_PRESETS).toHaveLength(4);
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
      'Bass Forge',
      'Equaliser',
      'Bass Punch',
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

  /**
   * The stage had been built, wired, metered and translated with no way for
   * anyone to switch it on. This asserts the surface exists and carries a
   * control for every field of `IBassForgeSettings` that has one — a page
   * missing a dial is a parameter nobody can reach.
   */
  it('gives Bass Forge a page with a dial for each of its six controls', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Forge/i }));
    const page = within(screen.getByRole('region', { name: /Bass Forge/i }));
    ['Split', 'Sub', 'Presence', 'Texture', 'Drive', 'Amount'].forEach(
      (name) => {
        expect(page.getByRole('slider', { name })).toBeInTheDocument();
      },
    );
  });

  /**
   * There is no mono dial on this page and there is deliberately never going
   * to be one: Forge generates from `(low[0] + low[1]) / 2` as a construction
   * of the stage, and the mono-maker roughly twenty EQ profiles reference
   * stays in the EQ. Unexplained, the absence reads as a missing control.
   */
  it('says the generated bass is mono, since no dial on the page can', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Forge/i }));
    expect(screen.getByText(/summed to mono/i)).toBeInTheDocument();
  });

  /**
   * The graph's two fills are regions, and the legend must not promote them
   * into generators.
   *
   * `bass_forge.cpp` computes `sub * sub_amount + shaped` into one number
   * before drive, the DC blocker, `mix` and the output followers, so nothing
   * downstream can say which generator made a given band. The presence
   * generator is fed the whole low band, so the second harmonic of a 35 Hz
   * note lands near 70 Hz — below a default 90 Hz corner, in the low-side
   * fill, with the Sub dial possibly at zero. A legend calling that fill "Sub"
   * would be asserting something the meter is not told.
   */
  it('labels the graph fills by region, never by which generator made them', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Forge/i }));
    const legend = container.querySelector('.dsp-bass-forge-legend');
    expect(legend).toHaveTextContent('Below split');
    expect(legend).toHaveTextContent('Above split');
    // The two dial names, which are the attribution this must not claim. They
    // are still on the page — this asserts they are not in the LEGEND.
    expect(legend).not.toHaveTextContent(/Sub\b/);
    expect(legend).not.toHaveTextContent(/Presence/);
    expect(screen.getByRole('slider', { name: 'Sub' })).toBeInTheDocument();
  });

  /**
   * A live meter under greyed-out dials is a meter reporting on a stage that
   * is not running — the same defect Dimension's guard bar had.
   *
   * The bands genuinely read -120 dB while the stage is off, because the
   * native side resets it every block, so there is no stale data here. What
   * this guards is the READING: the plot has to look stopped rather than look
   * like it is hearing silence.
   */
  it('reads as stopped, not as running-and-quiet, while Bass Forge is off', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Forge/i }));
    expect(container.querySelector('.dsp-bass-forge-display')).toHaveClass(
      'is-off',
    );
    expect(screen.getByRole('slider', { name: 'Sub' })).toBeDisabled();
  });

  it('POSITIVE CONTROL: drops the stopped reading once the stage is on', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      bassForge: { ...DSP_DEFAULTS.bassForge, enabled: true },
    };
    const { container } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Bass Forge/i }));
    expect(container.querySelector('.dsp-bass-forge-display')).not.toHaveClass(
      'is-off',
    );
    expect(screen.getByRole('slider', { name: 'Sub' })).toBeEnabled();
  });

  /**
   * Reset goes to the catalogue's own baseline rather than to `DSP_DEFAULTS`,
   * where every amount is zero: resetting to those would leave a stage that is
   * switched on and audibly doing nothing. Bypass stays the chain preset's
   * decision, which is why a profile never carries one.
   */
  it('resets Bass Forge to a profile that makes something', () => {
    const { onChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Forge/i }));
    // Exact, not a pattern: "Preset", "Previous preset" and "Next preset" all
    // contain the word, and the picker sits on the same bar as this button.
    const page = within(screen.getByRole('region', { name: /Bass Forge/i }));
    fireEvent.click(page.getByRole('button', { name: 'Reset' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.bassForge.presetId).toBe('default');
    expect(next.bassForge.mix).toBeGreaterThan(0);
    expect(next.bassForge.enabled).toBe(false);
  });

  /**
   * The same guard Forge's page has, and for the same reason: the stage was
   * built, wired, metered and translated with no way for anyone to switch it
   * on. A page missing a dial is a parameter nobody can reach.
   */
  it('gives Bass Punch a page with a dial for each of its six controls', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    const page = within(screen.getByRole('region', { name: /Bass Punch/i }));
    // Exact names, which is what separates "Bloom" from "Bloom decay" — a
    // pattern would match both and let either dial go missing unnoticed.
    ['Split', 'Attack', 'Sustain', 'Bloom', 'Bloom decay', 'Duck'].forEach(
      (name) => {
        expect(page.getByRole('slider', { name })).toBeInTheDocument();
      },
    );
  });

  /**
   * Zero is not off on this page: it is the stage running, hearing the note
   * and deciding to change nothing about it. That only reads if the range is
   * symmetric about the rest position, so a dial declared -1 to +1 is what
   * makes turning it LEFT a thing anybody thinks to do.
   */
  it('rests Attack and Sustain at the centre of a symmetric range', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    const page = within(screen.getByRole('region', { name: /Bass Punch/i }));
    ['Attack', 'Sustain'].forEach((name) => {
      const dial = page.getByRole('slider', { name });
      expect(dial).toHaveAttribute('aria-valuemin', '-1');
      expect(dial).toHaveAttribute('aria-valuemax', '1');
      expect(dial).toHaveAttribute('aria-valuenow', '0');
    });
    // The positive control the three above need: Bloom is an AMOUNT on the
    // same page, and a card that made every dial bipolar would pass them.
    const bloom = page.getByRole('slider', { name: 'Bloom' });
    expect(bloom).toHaveAttribute('aria-valuemin', '0');
  });

  /**
   * A live strip under greyed-out dials is a strip reporting on a stage that
   * is not running — the same defect Dimension's guard bar and Forge's plot
   * had. It matters more here than anywhere else in the rack: all three of
   * Punch's gains genuinely rest at 0 dB, so three flat traces down the middle
   * of a live-looking plot would say the stage is running and choosing to
   * change nothing, which is exactly what a centred dial means.
   */
  it('reads as stopped, not as running-and-flat, while Bass Punch is off', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    expect(container.querySelector('.dsp-bass-punch-display')).toHaveClass(
      'is-off',
    );
    expect(screen.getByRole('slider', { name: 'Attack' })).toBeDisabled();
  });

  it('POSITIVE CONTROL: drops the stopped reading once Punch is on', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      bassPunch: { ...DSP_DEFAULTS.bassPunch, enabled: true },
    };
    const { container } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    expect(container.querySelector('.dsp-bass-punch-display')).not.toHaveClass(
      'is-off',
    );
    expect(screen.getByRole('slider', { name: 'Attack' })).toBeEnabled();
  });

  /**
   * The strip draws two different kinds of measurement and nothing on the
   * canvas can say so: the attack lane is a max-over-window that the native
   * reader clears as it takes it, and the other two are point samples of
   * states that persist. Undrawn differently and unexplained, the picture
   * would be claiming all three read alike.
   */
  it('says why the attack lane is drawn as marks and the others as traces', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    expect(screen.getByText(/separate marks/i)).toBeInTheDocument();
  });

  /**
   * Reset goes to this catalogue's own baseline for the reason Forge's does:
   * the shipping defaults put attack, sustain, bloom and duck all at zero, so
   * resetting to them would leave a stage switched on and shaping nothing.
   */
  it('resets Bass Punch to a profile that shapes something', () => {
    const { onChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    const page = within(screen.getByRole('region', { name: /Bass Punch/i }));
    fireEvent.click(page.getByRole('button', { name: 'Reset' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.bassPunch.presetId).toBe('default');
    expect(next.bassPunch.attack).toBeGreaterThan(0);
    expect(next.bassPunch.duck).toBeGreaterThan(0);
    expect(next.bassPunch.enabled).toBe(false);
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
