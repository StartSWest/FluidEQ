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

beforeEach(() => {
  window.localStorage.clear();
  keepGamesForCore.mockClear();
  keepDspPresetsForCore.mockClear();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { ipcRenderer: { keepGamesForCore, keepDspPresetsForCore } },
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
