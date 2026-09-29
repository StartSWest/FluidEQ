/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import { DSP_DEFAULTS, IDspSettings } from '../../common/dsp/chain';
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

describe('DspPanel and the engine', () => {
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
  it('does NOT claim a failure when the engine has simply not started', async () => {
    act(() => setDspNativeState('idle'));
    const { container, onChange } = renderPanel(DSP_DEFAULTS, 'idle');
    expect(screen.queryByText(/could not start/i)).not.toBeInTheDocument();
    expect(
      await screen.findByText(/Play an audio track from Library to use DSP/i),
    ).toBeInTheDocument();
    // Amber on the strip that carries the sentence, its glyph and its button
    // (`DspScopeNotice`), rather than on the sentence alone.
    expect(
      screen
        .getByText(/Play an audio track from Library to use DSP/i)
        .closest('.dsp-scope'),
    ).toHaveClass('is-idle');
    // The indicator reflects active processing, while the saved preference
    // stays enabled so Library playback can restore it without another click.
    expect(screen.getByRole('checkbox', { name: 'DSP' })).not.toBeChecked();
    expect(DSP_DEFAULTS.enabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeDisabled();
    expect(container.querySelector('.dsp-stage')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('turns the rack on once a track engages the engine', () => {
    // The positive control for the case above: every one of those assertions
    // would also pass for a panel that is simply always off. This is the same
    // panel, the same defaults, one state apart.
    act(() => setDspNativeState('engaged'));
    const { container } = renderPanel(DSP_DEFAULTS, 'running');
    expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeEnabled();
    expect(container.querySelector('.dsp-stage')).toHaveAttribute(
      'aria-disabled',
      'false',
    );
    const rail = screen.getByRole('navigation', { name: 'DSP' });
    expect(
      within(
        rail.querySelector('.dsp-rail-processors') as HTMLElement,
      ).getByRole('button', { name: /Normalizer/i }),
    ).toBeEnabled();
  });

  it.each(['karaoke', 'media', 'system'] as const)(
    'disables DSP for %s and restores Library controls without changing the saved sound',
    (owner) => {
      const { container, onChange } = renderPanel();
      expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeEnabled();
      act(() => claimPlayback(owner));
      expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: 'DSP' })).not.toBeChecked();
      expect(container.querySelector('.dsp-stage')).toHaveAttribute('inert');
      expect(screen.getByRole('button', { name: /Crossfade/i })).toBeDisabled();
      act(() => claimPlayback('library'));
      expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeEnabled();
      expect(container.querySelector('.dsp-stage')).not.toHaveAttribute(
        'inert',
      );
      expect(onChange).not.toHaveBeenCalled();
    },
  );

  /**
   * The receiver role describes a connection, not the source feeding the
   * rack. A Library deck that owns playback keeps its controls while Share
   * Audio is listening; it is only once nothing of the Library's is playing
   * that received audio, which the rack never touches, leaves the page inert.
   */
  describe('while Share Audio is listening', () => {
    const remote: IRemoteAudioValue = {
      connectedCount: 1,
      connectedComputers: [],
      lanOptions: [],
      networkStats: [],
      phase: 'connected',
      role: 'listener',
      startListening: jest.fn(),
      startSending: jest.fn(),
      stop: jest.fn(),
      resumePlayback: jest.fn(),
      subscribeMeter: jest.fn(() => jest.fn()),
    };

    it('keeps the rack for a Library deck that owns playback', () => {
      const { container, onChange } = renderPanel(
        DSP_DEFAULTS,
        'running',
        remote,
      );
      expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeEnabled();
      expect(container.querySelector('.dsp-stage')).not.toHaveAttribute(
        'inert',
      );
      expect(onChange).not.toHaveBeenCalled();
    });

    it('goes inert once nothing of the Library is playing', () => {
      act(() => stopAllPlayback());
      const { container, onChange } = renderPanel(
        DSP_DEFAULTS,
        'running',
        remote,
      );
      expect(screen.getByRole('checkbox', { name: 'DSP' })).toBeDisabled();
      expect(container.querySelector('.dsp-stage')).toHaveAttribute('inert');
      expect(screen.getByRole('button', { name: /Crossfade/i })).toBeDisabled();
      expect(onChange).not.toHaveBeenCalled();
    });
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
    expect(container.querySelector('.dsp-stage')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('keeps Crossfade available while the filter rack is bypassed', () => {
    const bypassed: IDspSettings = {
      ...DSP_DEFAULTS,
      enabled: false,
      presetId: 'rock',
    };
    const { onChange } = renderPanel(bypassed);
    const rail = screen.getByRole('navigation', { name: 'DSP' });
    const filters = within(
      rail.querySelector('.dsp-rail-processors') as HTMLElement,
    );
    const playback = within(
      rail.querySelector('.dsp-rail-playback') as HTMLElement,
    );
    expect(filters.getByRole('button', { name: /Normalizer/i })).toBeDisabled();
    const crossfadeTab = playback.getByRole('button', {
      name: /Crossfade/i,
    });
    expect(crossfadeTab).toBeEnabled();
    fireEvent.click(crossfadeTab);
    const crossfadeToggle = screen.getByRole('checkbox', {
      name: 'Crossfade',
    });
    expect(crossfadeToggle).toBeEnabled();
    fireEvent.click(crossfadeToggle);
    const next = onChange.mock.calls[0][0] as IDspSettings;
    expect(next.enabled).toBe(false);
    expect(next.presetId).toBe('rock');
    expect(next.crossfade.enabled).toBe(true);
  });
});
