/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window hands the core its lists at launch — which also hands over
 * everything kept before the core kept anything — and again whenever one
 * changes, here or in another window.
 */
import { act, render } from '@testing-library/react';
import CoreCopies from 'renderer/CoreCopies';
import { saveUserDspPreset } from 'renderer/dsp/userDspPresets';
import { addGameProfile, setGamesEnabled } from 'renderer/games/gameProfiles';
import { DSP_DEFAULTS } from 'common/dsp/chain';

const keepGamesForCore = jest.fn();
const keepDspPresetsForCore = jest.fn();
const handRackHoldToCore = jest.fn();
const OLD_RACK_HOLD_KEY = 'fluideq.dsp.rackHeldForApo.v1';

beforeEach(() => {
  window.localStorage.clear();
  keepGamesForCore.mockClear();
  keepDspPresetsForCore.mockClear();
  handRackHoldToCore.mockClear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: {
      ipcRenderer: {
        keepGamesForCore,
        keepDspPresetsForCore,
        handRackHoldToCore,
      },
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electron');
});

describe('the window’s lists, handed to the core', () => {
  it('hands both over at launch, with what was kept before', () => {
    addGameProfile(
      { name: 'Quake', path: 'C:\\Games\\quake.exe', source: 'file' },
      'gaming',
    );
    saveUserDspPreset('Mine', DSP_DEFAULTS);
    keepGamesForCore.mockClear();
    render(<CoreCopies />);

    expect(keepGamesForCore).toHaveBeenCalledWith({
      enabled: true,
      profiles: [
        expect.objectContaining({ name: 'Quake', presetId: 'gaming' }),
      ],
    });
    expect(keepDspPresetsForCore).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Mine' }),
    ]);
  });

  it('hands each over again when it changes', () => {
    render(<CoreCopies />);
    keepGamesForCore.mockClear();
    keepDspPresetsForCore.mockClear();

    act(() => setGamesEnabled(false));
    expect(keepGamesForCore).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );

    act(() => {
      saveUserDspPreset('Night', DSP_DEFAULTS);
    });
    expect(keepDspPresetsForCore).toHaveBeenLastCalledWith([
      expect.objectContaining({ name: 'Night' }),
    ]);
  });
});

/*
 * Which preset's rack Equalizer APO held off was the window's to keep, and is
 * the core's now (`main/presetPicks.ts`): an update hands the old one over
 * once, so a switch to the FluidEQ Engine still puts that rack back.
 */
describe('the rack hold an older window kept', () => {
  it('is handed to the core once and forgotten here', () => {
    window.localStorage.setItem(OLD_RACK_HOLD_KEY, 'gaming');
    const { unmount } = render(<CoreCopies />);
    expect(handRackHoldToCore).toHaveBeenCalledWith('gaming');
    expect(window.localStorage.getItem(OLD_RACK_HOLD_KEY)).toBeNull();

    unmount();
    render(<CoreCopies />);
    expect(handRackHoldToCore).toHaveBeenCalledTimes(1);
  });

  it('hands over nothing where nothing was held', () => {
    render(<CoreCopies />);
    expect(handRackHoldToCore).not.toHaveBeenCalled();
  });

  it('stays where it is while there is no core to take it', () => {
    window.localStorage.setItem(OLD_RACK_HOLD_KEY, 'gaming');
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { ipcRenderer: { keepGamesForCore, keepDspPresetsForCore } },
    });
    render(<CoreCopies />);
    expect(window.localStorage.getItem(OLD_RACK_HOLD_KEY)).toBe('gaming');
  });
});
