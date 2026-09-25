/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A preset is one choice on both engines: its curve plays on either, its rack
 * only where a rack can run for the whole machine. Equalizer APO has none, so
 * a switch there holds the picked preset's rack off, and the switch back puts
 * it on — and nothing else: a rack switched off by hand stays off.
 */
import { render } from '@testing-library/react';
import { DSP_DEFAULTS, IDspSettings } from 'common/dsp/chain';
import { dspPresetSettings } from 'common/dsp/presets';
import type { TAudioEngine } from 'common/audioEngine';
import type { IVoicingSettings } from 'common/constants';
import RackFollowsEngine from 'renderer/dsp/RackFollowsEngine';
import { holdRackForApo, rackHeldForApo } from 'renderer/dsp/rackHeldForApo';
import { applyDspSettings, readDspSettings } from 'renderer/dsp/store';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import defaultContext from '__tests__/utils/mockFluidEqProvider';

jest.mock('renderer/dsp/systemChain', () => ({
  sendSystemDspChain: jest.fn(),
}));
let mockEngine: TAudioEngine | null = null;
jest.mock('renderer/utils/useAudioEngineStatus', () => ({
  useKnownAudioEngineStatus: () =>
    mockEngine === null ? undefined : { engine: mockEngine },
}));

const GAMING = dspPresetSettings('gaming', DSP_DEFAULTS) as IDspSettings;
const PLAYING: IVoicingSettings = { profileId: 'dsp:gaming', intensity: 1 };

const mount = (voicing: IVoicingSettings | undefined) => {
  const view = (engine: TAudioEngine | null) => {
    mockEngine = engine;
    return (
      <FluidEqProviderWrapper value={{ ...defaultContext, voicing }}>
        <RackFollowsEngine />
      </FluidEqProviderWrapper>
    );
  };
  return { view, ...render(view(null)) };
};

beforeEach(() => {
  localStorage.clear();
  mockEngine = null;
});

it('holds a picked preset’s rack off at a switch to APO, and puts it back at the switch home', () => {
  applyDspSettings(GAMING);
  const { rerender, view } = mount(PLAYING);
  rerender(view('fluid'));
  // The first answer about the engine is not a switch.
  expect(readDspSettings().enabled).toBe(true);

  rerender(view('apo'));
  expect(readDspSettings()).toMatchObject({
    presetId: 'gaming',
    enabled: false,
    gameMode: false,
  });
  expect(rackHeldForApo()).toBe('gaming');

  rerender(view('fluid'));
  // The whole rack again, Game mode and all.
  expect(readDspSettings()).toEqual(GAMING);
  expect(rackHeldForApo()).toBeUndefined();
});

it('leaves a rack switched off by hand off through both switches', () => {
  applyDspSettings({ ...GAMING, enabled: false });
  const { rerender, view } = mount(PLAYING);
  rerender(view('fluid'));
  rerender(view('apo'));
  rerender(view('fluid'));
  expect(readDspSettings().enabled).toBe(false);
  expect(rackHeldForApo()).toBeUndefined();
});

it('leaves a rack alone at a switch to APO when the curve playing is not its preset', () => {
  applyDspSettings(GAMING);
  const { rerender, view } = mount({ profileId: 'music', intensity: 1 });
  rerender(view('fluid'));
  rerender(view('apo'));
  expect(readDspSettings().enabled).toBe(true);
  expect(rackHeldForApo()).toBeUndefined();
});

it('puts a held rack back on only for the preset it held', () => {
  applyDspSettings({ ...GAMING, enabled: false });
  holdRackForApo('movie');
  const { rerender, view } = mount(PLAYING);
  rerender(view('apo'));
  rerender(view('fluid'));
  expect(readDspSettings().enabled).toBe(false);
  // The switch home ends the hold whether or not it matched.
  expect(rackHeldForApo()).toBeUndefined();
});
