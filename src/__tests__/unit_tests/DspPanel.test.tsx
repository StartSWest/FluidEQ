/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import { DSP_DEFAULTS, IDspSettings } from '../../common/dsp/chain';
import { DSP_PRESETS } from '../../common/dsp/presets';
import { FluidEqProviderWrapper } from '../../renderer/utils/FluidEqContext';
import DspPanel from '../../renderer/dsp/DspPanel';
import { DSP_OPEN_SECTION_KEY } from '../../renderer/dsp/openSection';
import {
  claimPlayback,
  stopAllPlayback,
} from '../../renderer/audio/playbackOwner';
import RemoteAudioContext, {
  RemoteAudioRoleContext,
} from '../../renderer/remoteAudio/remoteAudioValueContext';
import type { IRemoteAudioValue } from '../../renderer/remoteAudio/remoteAudioState';
import type { IAudioEngineStatus } from '../../common/audioEngine';
import { getAudioEngineStatus } from '../../renderer/utils/audioEngineApi';
import {
  refreshAudioEngineStatus,
  resetAudioEngineStatus,
} from '../../renderer/utils/useAudioEngineStatus';
import {
  TDspEngineState,
  setDspNativeState,
  setDspSampleRate,
} from '../../renderer/dsp/store';

/**
 * Main's answer about the engine, as Equalizer APO: the configuration this
 * page's Library-only scope belongs to.
 *
 * The scope line says nothing until main has answered — guessing "Library
 * only" for the frames before the reply is the flash it used to show under a
 * system-wide rack — so every case that reads that line needs an answer.
 */
jest.mock('../../renderer/utils/audioEngineApi', () => ({
  ...jest.requireActual('../../renderer/utils/audioEngineApi'),
  getAudioEngineStatus: jest.fn(),
}));

/**
 * The main EQ's side of a pick. A preset's tone is its Preset layer there
 * (`presetCurve.ts`), sent before the rack is set, so a pick finishes a
 * moment after the click rather than inside it.
 */
const mockSetVoicing = jest.fn();
jest.mock('../../renderer/utils/equalizerApi', () => ({
  ...jest.requireActual('../../renderer/utils/equalizerApi'),
  setVoicing: (...args: unknown[]) => mockSetVoicing(...args),
}));

const APO_STATUS: IAudioEngineStatus = {
  engine: 'apo',
  apo: { installed: true },
  fluid: { installed: false, endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
};

/**
 * Wrapped in the FluidEQ provider because the faders are the equaliser's own
 * `Slider`, which reads `isBlockingError` from it to decide whether it may be
 * dragged at all.
 */
const renderPanel = (
  settings: IDspSettings = DSP_DEFAULTS,
  engineState: TDspEngineState = 'running',
  remoteAudio: IRemoteAudioValue | undefined = undefined,
) => {
  const onChange = jest.fn();
  const onCommit = jest.fn();
  // The shell's own question, asked once at launch (`AppContent`): the page
  // reads that answer and asks main nothing itself.
  refreshAudioEngineStatus();
  // Both contexts, as `RemoteAudioProvider` supplies them: the page reads the
  // role alone, from its own context.
  const view = render(
    <RemoteAudioContext.Provider value={remoteAudio}>
      <RemoteAudioRoleContext.Provider value={remoteAudio?.role}>
        <FluidEqProviderWrapper
          value={{ ...defaultFluidEqContext, isEnabled: true }}
        >
          <DspPanel
            settings={settings}
            onChange={onChange}
            onCommit={onCommit}
            engineState={engineState}
          />
        </FluidEqProviderWrapper>
      </RemoteAudioRoleContext.Provider>
    </RemoteAudioContext.Provider>,
  );
  return { ...view, onChange, onCommit };
};

describe('DspPanel', () => {
  beforeEach(() => {
    resetAudioEngineStatus();
    // The page opens where it was last left, which is a per-machine preference
    // and not what any of these cases is about: without this, a case that
    // opens a processor decides which card the next one renders.
    window.localStorage.removeItem(DSP_OPEN_SECTION_KEY);
    jest.mocked(getAudioEngineStatus).mockResolvedValue(APO_STATUS);
    act(() => {
      claimPlayback('library');
      setDspNativeState('engaged');
    });
  });

  afterEach(() =>
    act(() => {
      stopAllPlayback();
      setDspNativeState('idle');
    }),
  );

  /**
   * The rule a test can check even though the ones it protects against cannot.
   *
   * Every other pill in the EQ group configures Equalizer APO and changes all
   * system audio; this one only touches FluidEQ's own player. Someone who
   * assumes otherwise reports the feature as broken, so the notice is visible
   * body text rather than a tooltip — and this asserts it is actually rendered
   * rather than merely written into the dictionary.
   */
  it('states its scope in visible text', async () => {
    renderPanel();
    expect(
      await screen.findByText(
        /DSP processes audio tracks played from Library only/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Received shared audio, karaoke, videos and other apps are not processed/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows the automatic system rate compactly in the DSP title', () => {
    setDspSampleRate(48_000);
    renderPanel();
    expect(
      screen.getByRole('heading', { name: /48 kHz/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/device bits/i)).not.toBeInTheDocument();
  });

  /** Every complete chain is reachable from the one searchable preset menu. */
  it('offers every factory preset', () => {
    const { container } = renderPanel();
    const presets = within(
      container.querySelector('.dsp-presets') as HTMLElement,
    );
    fireEvent.click(presets.getByRole('button', { name: 'Presets' }));
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(
      DSP_PRESETS.length,
    );
    // Include the new worldwide genre chains; the literal is here so that
    // a chain added without a row in the menu is a failure
    // rather than a menu quietly one short.
    expect(DSP_PRESETS).toHaveLength(108);
    expect(
      screen.getByRole('menuitemradio', { name: /Repair compressed/i }),
    ).toBeInTheDocument();
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
    const railElement = screen.getByRole('navigation', { name: 'DSP' });
    const rail = within(railElement);
    [
      'Normalizer',
      'Denoise',
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
    const filters = within(
      railElement.querySelector('.dsp-rail-processors') as HTMLElement,
    );
    const playback = within(
      railElement.querySelector('.dsp-rail-playback') as HTMLElement,
    );
    expect(filters.queryByRole('button', { name: /Crossfade/i })).toBeNull();
    expect(playback.getByRole('button', { name: /Crossfade/i })).toBeVisible();
    expect(playback.getByText('Playback options')).toBeVisible();
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
  it('gives Bass Punch a page with a dial for each of its seven controls', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    const page = within(screen.getByRole('region', { name: /Bass Punch/i }));
    // Exact names, which is what separates "Bloom" from "Bloom decay" — a
    // pattern would match both and let either dial go missing unnoticed.
    [
      'Bass focus',
      'Attack',
      'Sustain',
      'Bloom',
      'Bloom decay',
      'Tail duck',
      'Mix',
    ].forEach((name) => {
      expect(page.getByRole('slider', { name })).toBeInTheDocument();
    });
  });

  /**
   * Zero is not off on this page: it is the stage running, hearing the note
   * and deciding to change nothing about it. That only reads if the range is
   * symmetric about the rest position, so a dial declared -1 to +1 is what
   * makes turning it LEFT a thing anybody thinks to do.
   */
  it('displays 0–200% Mix and sends the full effect amount to the engine', () => {
    const { onChange } = renderPanel({
      ...DSP_DEFAULTS,
      bassPunch: { ...DSP_DEFAULTS.bassPunch, enabled: true },
    });
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    const mix = screen.getByRole('slider', { name: 'Mix' });
    expect(mix).toHaveAttribute('aria-valuemin', '0');
    expect(mix).toHaveAttribute('aria-valuemax', '200');
    expect(mix).toHaveAttribute('aria-valuenow', '100');
    fireEvent.change(mix, { target: { value: '1' } });
    expect(onChange.mock.calls[0][0].bassPunch.mix).toBe(2);
  });

  it.each([0, 0.15])(
    'only offers Tail Duck with generated Bloom (%s)',
    (bloomAmount) => {
      renderPanel({
        ...DSP_DEFAULTS,
        bassPunch: { ...DSP_DEFAULTS.bassPunch, enabled: true, bloomAmount },
      });
      fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
      const duck = screen.getByRole('slider', { name: 'Tail duck' });
      expect((duck as HTMLInputElement).disabled).toBe(bloomAmount === 0);
    },
  );

  it('keeps Attack and Sustain bipolar with the audible default profile', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    const page = within(screen.getByRole('region', { name: /Bass Punch/i }));
    ['Attack', 'Sustain'].forEach((name) => {
      const dial = page.getByRole('slider', { name });
      expect(dial).toHaveAttribute('aria-valuemin', '-1');
      expect(dial).toHaveAttribute('aria-valuemax', '1');
      expect(dial).toHaveAttribute(
        'aria-valuenow',
        name === 'Attack' ? '0.65' : '-0.3',
      );
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
    expect(next.bassPunch.bloomAmount).toBe(0);
    expect(next.bassPunch.sustain).toBeLessThan(0);
    expect(next.bassPunch.mix).toBe(1);
    expect(next.bassPunch.enabled).toBe(false);
  });
});
