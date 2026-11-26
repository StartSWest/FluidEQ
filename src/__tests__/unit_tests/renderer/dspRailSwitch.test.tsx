/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A stage's switch on the DSP page's rail and the power switch on its card
 * are one control in two places (Ivan, 2026-11-25: "put toggles also on the
 * DSP and Gaming Lab, so we can toggle on and off the filters right there").
 * Each must make the same edit of the rack, read the same state back after
 * the other one moved it, and leave the page on the stage that was open.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import type { IAudioEngineStatus } from '../../../common/audioEngine';
import { DSP_DEFAULTS, IDspSettings } from '../../../common/dsp/chain';
import {
  claimPlayback,
  stopAllPlayback,
} from '../../../renderer/audio/playbackOwner';
import DspPanel from '../../../renderer/dsp/DspPanel';
import { dspStageSwitch } from '../../../renderer/dsp/dspStageSwitch';
import { DSP_OPEN_SECTION_KEY } from '../../../renderer/dsp/openSection';
import type { TDspSection } from '../../../renderer/dsp/sections';
import { setDspNativeState } from '../../../renderer/dsp/store';
import { getAudioEngineStatus } from '../../../renderer/utils/audioEngineApi';
import { FluidEqProviderWrapper } from '../../../renderer/utils/FluidEqContext';
import {
  refreshAudioEngineStatus,
  resetAudioEngineStatus,
} from '../../../renderer/utils/useAudioEngineStatus';

jest.mock('../../../renderer/utils/audioEngineApi', () => ({
  ...jest.requireActual('../../../renderer/utils/audioEngineApi'),
  getAudioEngineStatus: jest.fn(),
}));

const APO_STATUS: IAudioEngineStatus = {
  engine: 'apo',
  apo: { installed: true },
  fluid: { installed: false, endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
};

/** The page over a rack it really holds, so each switch reads the other's edit. */
const renderPanel = (start: IDspSettings) => {
  const seen: IDspSettings[] = [];
  const onCommit = jest.fn();
  const Host = () => {
    const [settings, setSettings] = useState(start);
    return (
      <DspPanel
        settings={settings}
        onChange={(next) => {
          seen.push(next);
          setSettings(next);
        }}
        onCommit={onCommit}
        engineState="running"
      />
    );
  };
  render(
    <FluidEqProviderWrapper
      value={{ ...defaultFluidEqContext, isEnabled: true }}
    >
      <Host />
    </FluidEqProviderWrapper>,
  );
  return { seen, onCommit };
};

const rail = () => within(screen.getByRole('navigation', { name: 'DSP' }));

/** The rail's switch for a stage, by what pressing it does. */
const railSwitch = (name: string, to: 'on' | 'off') =>
  rail().getByRole('checkbox', { name: `Turn ${name} ${to}` });

/** The power switch in the open stage's card, named for the stage. */
const cardSwitch = (name: string) =>
  within(screen.getByRole('region', { name })).getByRole('checkbox', {
    name,
  });

const openStage = (name: string) =>
  fireEvent.click(rail().getByRole('button', { name }));

describe('a stage switch on the DSP rail', () => {
  beforeEach(async () => {
    resetAudioEngineStatus();
    window.localStorage.removeItem(DSP_OPEN_SECTION_KEY);
    jest.mocked(getAudioEngineStatus).mockResolvedValue(APO_STATUS);
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

  it('turns the stage off as its card does, and each reads the other', () => {
    const start: IDspSettings = {
      ...DSP_DEFAULTS,
      presetId: 'balanced',
      room: { ...DSP_DEFAULTS.room, enabled: true },
    };
    const { seen, onCommit } = renderPanel(start);
    openStage('Room');
    expect(cardSwitch('Room')).toBeChecked();

    fireEvent.click(railSwitch('Room', 'off'));
    expect(seen).toHaveLength(1);
    expect(seen[0].room).toEqual({ ...start.room, enabled: false });
    // A stage's own switch is an edit of the preset's sound, as the card's is.
    expect(seen[0].presetId).toBe('');
    expect(onCommit).toHaveBeenCalledTimes(1);
    // The card reads the rail's edit, and the rail now offers the way back.
    expect(cardSwitch('Room')).not.toBeChecked();
    expect(railSwitch('Room', 'on')).not.toBeChecked();
    // Dimmed in the rail, as the Mic rail dims an off stage.
    expect(railSwitch('Room', 'on').closest('.dsp-rail-row')).toHaveClass(
      'is-off',
    );

    fireEvent.click(cardSwitch('Room'));
    expect(seen[1].room.enabled).toBe(true);
    expect(railSwitch('Room', 'off')).toBeChecked();
    expect(railSwitch('Room', 'off').closest('.dsp-rail-row')).not.toHaveClass(
      'is-off',
    );
  });

  it('makes exactly the edit the card makes, Isolate disarmed included', () => {
    const start: IDspSettings = {
      ...DSP_DEFAULTS,
      eq: { ...DSP_DEFAULTS.eq, enabled: true, isolate: true },
    };
    const { seen } = renderPanel(start);
    openStage('Equaliser');
    fireEvent.click(railSwitch('Equaliser', 'off'));
    const fromRail = seen[0];
    fireEvent.click(cardSwitch('Equaliser'));
    fireEvent.click(cardSwitch('Equaliser'));
    const fromCard = seen[2];
    expect(fromRail.eq).toEqual({
      ...start.eq,
      enabled: false,
      isolate: false,
    });
    expect(fromCard.eq).toEqual(fromRail.eq);
  });

  it('turns a stage over without leaving the stage that is open', () => {
    const { seen } = renderPanel({
      ...DSP_DEFAULTS,
      dimension: { ...DSP_DEFAULTS.dimension, enabled: false },
    });
    openStage('Room');
    fireEvent.click(railSwitch('Dimension', 'on'));
    expect(seen[0].dimension.enabled).toBe(true);
    expect(rail().getByRole('button', { name: 'Room' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(
      rail().getByRole('button', { name: 'Dimension' }),
    ).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('region', { name: 'Room' })).toBeInTheDocument();
  });

  it('draws the chosen stage as one band holding its switch', () => {
    renderPanel(DSP_DEFAULTS);
    openStage('Room');
    // The band is the row's, so the switch stands inside it (Ivan,
    // 2026-11-25: "a full band with the toggle inside").
    const chosen = rail().getByRole('button', { name: 'Room' });
    const row = chosen.closest('.dsp-rail-row');
    expect(row).toHaveClass('is-active');
    expect(row).toContainElement(railSwitch('Room', 'on'));
    expect(
      rail()
        .getByRole('button', { name: 'Dimension' })
        .closest('.dsp-rail-row'),
    ).not.toHaveClass('is-active');
  });

  it('keeps the preset named for the source level and the transition', () => {
    const { seen } = renderPanel({ ...DSP_DEFAULTS, presetId: 'balanced' });
    const normalizerOn = DSP_DEFAULTS.normalizer.mode !== 'off';
    fireEvent.click(railSwitch('Normalizer', normalizerOn ? 'off' : 'on'));
    expect(seen[0].normalizer.mode).toBe(normalizerOn ? 'off' : 'truePeak');
    expect(seen[0].presetId).toBe('balanced');
  });
});

describe('dspStageSwitch', () => {
  const SECTIONS: TDspSection[] = [
    'normalizer',
    'denoise',
    'deEsser',
    'crossfade',
    'eq',
    'footsteps',
    'exciter',
    'bassForge',
    'bassPunch',
    'dimension',
    'room',
    'dynamics',
    'maximizer',
    'master',
  ];

  it.each(SECTIONS)(
    'turns %s over and back to the rack it started from',
    (section) => {
      const once = dspStageSwitch(section, DSP_DEFAULTS);
      const turned = { ...DSP_DEFAULTS, ...once.patch };
      const twice = dspStageSwitch(section, turned);
      const back = { ...turned, ...twice.patch };
      // Only the stage's own entry moves.
      expect(Object.keys(once.patch)).toEqual([section]);
      expect(turned[section]).not.toEqual(DSP_DEFAULTS[section]);
      expect(back[section]).toEqual(DSP_DEFAULTS[section]);
      // The stages no preset sets keep the preset's name when switched.
      expect(once.preservePreset).toBe(
        section === 'normalizer' ||
          section === 'master' ||
          section === 'crossfade',
      );
    },
  );
});
