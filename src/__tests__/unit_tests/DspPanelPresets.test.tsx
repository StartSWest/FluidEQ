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
import { TDspEngineState, setDspNativeState } from '../../renderer/dsp/store';

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

describe('DspPanel presets, isolates and monitors', () => {
  beforeEach(async () => {
    resetAudioEngineStatus();
    // The page opens where it was last left, which is a per-machine preference
    // and not what any of these cases is about: without this, a case that
    // opens a processor decides which card the next one renders.
    window.localStorage.removeItem(DSP_OPEN_SECTION_KEY);
    jest.mocked(getAudioEngineStatus).mockResolvedValue(APO_STATUS);
    // The shell's own question, asked once at launch (`AppContent`) and
    // answered before the page opens: the page reads that answer and asks
    // main nothing itself. Asked while rendering and never awaited, the
    // answer landed after each case and re-rendered the page outside act.
    await act(() => refreshAudioEngineStatus());
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

  it('turns on every filter when one of its presets is selected', () => {
    const cases = [
      {
        section: 'Denoise',
        trigger: 'Preset',
        item: /^Gentle cleanup/i,
        processor: 'denoise',
      },
      {
        section: 'Exciter',
        trigger: 'Preset',
        item: /^Air/i,
        processor: 'exciter',
      },
      {
        section: 'Bass Forge',
        trigger: 'Preset',
        item: /^Deep/i,
        processor: 'bassForge',
      },
      {
        section: 'Equaliser',
        trigger: 'Preset',
        item: /^Bass boost/i,
        processor: 'eq',
      },
      {
        section: 'Bass Punch',
        trigger: 'Preset',
        item: /^Slam/i,
        processor: 'bassPunch',
      },
      {
        section: 'Dimension',
        trigger: 'Preset',
        item: /^Expansive/i,
        processor: 'dimension',
      },
      {
        section: 'Maximizer',
        trigger: 'Preset',
        item: /^Transparent/i,
        processor: 'maximizer',
      },
      {
        section: 'Master',
        trigger: 'Destination',
        item: /^Cinema/i,
        processor: 'master',
      },
    ] as const;

    cases.forEach(({ section, trigger, item, processor }) => {
      const view = renderPanel();
      const rail = within(screen.getByRole('navigation', { name: 'DSP' }));
      fireEvent.click(
        rail.getByRole('button', {
          name: new RegExp(`^${section}$`, 'i'),
        }),
      );
      const page = within(
        screen.getByRole('region', { name: new RegExp(section, 'i') }),
      );
      fireEvent.click(page.getByRole('button', { name: trigger }));
      fireEvent.click(screen.getByRole('menuitemradio', { name: item }));

      const next = view.onChange.mock.calls[0][0] as IDspSettings;
      expect(next[processor].enabled).toBe(true);
      view.unmount();
    });
  });

  it('applies a preset whole when one is chosen: its tone to the main EQ, its rack here', async () => {
    mockSetVoicing.mockResolvedValue(undefined);
    const { onChange, onCommit } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
    await act(async () => {
      fireEvent.click(
        screen.getByRole('menuitemradio', { name: /Repair compressed/i }),
      );
    });
    const repair = DSP_PRESETS.find((preset) => preset.id === 'lossy-repair');
    expect(repair?.curve).toBeDefined();
    expect(mockSetVoicing).toHaveBeenCalledWith(
      'dsp:lossy-repair',
      1,
      repair?.curve,
    );
    expect(onChange).toHaveBeenCalledWith(repair?.settings);
    expect(onCommit).toHaveBeenCalled();
  });

  it('does not change Crossfade when a DSP preset is chosen', async () => {
    mockSetVoicing.mockResolvedValue(undefined);
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      crossfade: {
        ...DSP_DEFAULTS.crossfade,
        enabled: true,
        durationMs: 7_250,
        curve: 'smooth',
      },
    };
    const { onChange } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: 'Presets' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: /^Rock\s/i }));
    });
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.presetId).toBe('rock');
    expect(next.crossfade).toEqual(active.crossfade);
  });

  /**
   * The header says what the rack is doing, not what was asked for: the Room
   * takes every channel to place them around the head, so while it is on the
   * switch reads All channels and holds still.
   */
  it('shows the Room holding every channel, and holds the switch still', () => {
    const pair: IDspSettings = {
      ...DSP_DEFAULTS,
      surround: { allChannels: false },
    };
    const surround = (root: HTMLElement) =>
      root.querySelector('.dsp-surround') as HTMLElement;
    const chosen = renderPanel(pair);
    // POSITIVE CONTROL: with the Room off it is the listener's own choice.
    expect(surround(chosen.container).textContent).toContain('Front pair');
    expect(
      within(surround(chosen.container)).getByRole('checkbox', {
        name: 'Surround',
      }),
    ).toBeEnabled();
    // Nothing is holding it, so there is no padlock beside it. Read while it
    // is still mounted: a detached container answers every query with null,
    // which is a control that passes whatever the component does.
    expect(surround(chosen.container).querySelector('.dsp-switch-held')).toBe(
      null,
    );
    chosen.unmount();

    const withRoom = renderPanel({
      ...pair,
      room: { ...DSP_DEFAULTS.room, enabled: true },
    });
    expect(surround(withRoom.container).textContent).toContain('All channels');
    expect(
      within(surround(withRoom.container)).getByRole('checkbox', {
        name: 'Surround',
      }),
    ).toBeDisabled();
    // And it shows that it is being held, inside the group that is held: a
    // switch that will not move with nothing beside it reads as broken. The
    // padlock is in the surround group and nowhere else in the header, which
    // is what stops it reading as the power switch's.
    expect(
      surround(withRoom.container).querySelector('.dsp-switch-held'),
    ).not.toBeNull();
    expect(
      withRoom.container.querySelectorAll('.dsp-switch-held'),
    ).toHaveLength(1);
    // What holds it is the group's own tooltip, in a sentence.
    expect(surround(withRoom.container).getAttribute('title')).toMatch(/Room/i);
  });

  /**
   * The surround switch says which channels of THIS output the rack runs on,
   * so it belongs to the machine and not to a recipe — the same rule the
   * crossfade above follows. Every recipe is built from the defaults, where
   * the rack runs on all of them, so without this the switch flipped itself
   * back on the way through a preset or the rack's own Reset.
   */
  it('keeps the surround switch through a preset and through Reset', async () => {
    mockSetVoicing.mockResolvedValue(undefined);
    const pair: IDspSettings = {
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, enabled: true },
      surround: { allChannels: false },
    };
    const { container, onChange } = renderPanel(pair);
    const rack = within(container.querySelector('.dsp-presets') as HTMLElement);
    fireEvent.click(rack.getByRole('button', { name: 'Presets' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: /^Rock\s/i }));
    });
    const chosen = onChange.mock.calls[0][0] as IDspSettings;
    expect(chosen.surround).toEqual({ allChannels: false });

    onChange.mockClear();
    await act(async () => {
      fireEvent.click(rack.getByRole('button', { name: 'Reset' }));
    });
    const reset = onChange.mock.calls[0][0] as IDspSettings;
    expect(reset.surround).toEqual({ allChannels: false });
    // POSITIVE CONTROL: Reset did its job on everything that IS the sound —
    // it is the Default chain, picked (Ivan, 2026-09-22: "reset set default
    // profile"), where it was the bare defaults, which sounded like None.
    expect(reset.presetId).toBe('balanced');
    expect(reset.enabled).toBe(true);
  });

  /*
   * None stands above everything in the rack's picker, the starred ones
   * included, as it does on the equaliser's page, and takes no star (Ivan,
   * 2026-09-22: "none is on top of all even fav").
   */
  it('lists None first, above the Favourites, and without a star', () => {
    const { container } = renderPanel();
    const rack = within(container.querySelector('.dsp-presets') as HTMLElement);
    fireEvent.click(rack.getByRole('button', { name: 'Presets' }));
    const rows = screen
      .getAllByRole('menuitemradio')
      .map((row) => row.textContent ?? '');
    expect(rows[0]).toMatch(/^None/);
    // POSITIVE CONTROL: the starred ones are there, straight under it.
    expect(screen.getByText('Favourites')).toBeInTheDocument();
    expect(rows[1]).toMatch(/^Default/);
    expect(
      screen.queryByRole('button', { name: /Favourites: None$/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('menuitemradio', { name: /^None/ }),
    ).toHaveLength(1);
  });

  it('keeps the filter preset at the left of its header', () => {
    const { container } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Denoise/i }));
    const header = container.querySelector('#dsp-denoise .dsp-card-header');
    expect(header).not.toBeNull();
    const visible = Array.from(header?.children ?? []).filter(
      (child) => !child.classList.contains('is-visually-hidden'),
    );
    expect(visible[0]).toHaveClass('dsp-denoise-bar');
    expect(visible[1]).toHaveClass('dsp-card-titles');
  });

  it('toggles a processor without disturbing the others', () => {
    const { onChange } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Exciter/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Exciter' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.exciter.enabled).toBe(true);
    expect(next.eq.enabled).toBe(false);
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

  it('turns Denoise Isolate off before bypassing Denoise', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      denoise: { ...DSP_DEFAULTS.denoise, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Denoise/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Denoise' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.denoise.enabled).toBe(false);
    expect(next.denoise.isolate).toBe(false);
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

  it('turns Denoise Isolate off before leaving the Denoise view', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      denoise: { ...DSP_DEFAULTS.denoise, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Denoise/i }));
    fireEvent.click(screen.getByRole('button', { name: /Maximizer/i }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.denoise.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  /*
   * The two bass stages get the same four cases as everything else, and they
   * are here because they were not: both shipped with isolate switches and
   * neither was added to the panel's clearing paths or to its bypass toggle,
   * so leaving either page with the monitor on left the whole rack playing
   * that stage's contribution alone, with the switch that did it out of sight.
   */
  it('turns Bass Punch Isolate off before bypassing Bass Punch', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      bassPunch: { ...DSP_DEFAULTS.bassPunch, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bass Punch' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.bassPunch.enabled).toBe(false);
    expect(next.bassPunch.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  it('turns Bass Forge Isolate off before bypassing Bass Forge', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      bassForge: { ...DSP_DEFAULTS.bassForge, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Bass Forge/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Bass Forge' }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.bassForge.enabled).toBe(false);
    expect(next.bassForge.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  it('turns Bass Punch Isolate off before leaving the Bass Punch view', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      bassPunch: { ...DSP_DEFAULTS.bassPunch, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Bass Punch/i }));
    fireEvent.click(screen.getByRole('button', { name: /Maximizer/i }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.bassPunch.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  it('turns Bass Forge Isolate off before leaving the Bass Forge view', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      bassForge: { ...DSP_DEFAULTS.bassForge, enabled: true, isolate: true },
    };
    const { onChange, onCommit } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Bass Forge/i }));
    fireEvent.click(screen.getByRole('button', { name: /Maximizer/i }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.bassForge.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });

  /**
   * Leaving a page is not editing it, so the chain must still name its preset.
   *
   * The clear goes through `patch`, which blanks the chain's `presetId`
   * because a sound edit stops a preset being that preset. Turning a monitor
   * off is not a sound edit — every card's own Isolate switch bypasses `patch`
   * for exactly this reason — so without `preservePreset` set, switching tabs
   * with a monitor on marked the whole rack Custom.
   */
  it('keeps the chain preset when a monitor is cleared on the way out', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      presetId: 'rock',
      bassForge: { ...DSP_DEFAULTS.bassForge, enabled: true, isolate: true },
    };
    const { onChange } = renderPanel(active);
    fireEvent.click(screen.getByRole('button', { name: /Bass Forge/i }));
    fireEvent.click(screen.getByRole('button', { name: /Maximizer/i }));
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.bassForge.isolate).toBe(false);
    expect(next.presetId).toBe('rock');
  });

  it('turns every monitor flag off when the DSP workspace closes', () => {
    const active: IDspSettings = {
      ...DSP_DEFAULTS,
      denoise: { ...DSP_DEFAULTS.denoise, enabled: true, isolate: true },
      eq: { ...DSP_DEFAULTS.eq, enabled: true, isolate: true },
      exciter: { ...DSP_DEFAULTS.exciter, enabled: true, isolate: true },
      bassForge: { ...DSP_DEFAULTS.bassForge, enabled: true, isolate: true },
      bassPunch: { ...DSP_DEFAULTS.bassPunch, enabled: true, isolate: true },
    };
    const { unmount, onChange, onCommit } = renderPanel(active);
    unmount();
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.denoise.isolate).toBe(false);
    expect(next.eq.isolate).toBe(false);
    expect(next.exciter.isolate).toBe(false);
    expect(next.bassForge.isolate).toBe(false);
    expect(next.bassPunch.isolate).toBe(false);
    expect(onCommit).toHaveBeenCalled();
  });
});
