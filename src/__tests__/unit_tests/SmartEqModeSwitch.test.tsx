/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { FilterTypeEnum, getDefaultState } from 'common/constants';
import {
  getEqualizerState,
  setSmartEq as setSmartEqApi,
} from 'renderer/utils/equalizerApi';
import { FluidEqProvider } from 'renderer/utils/FluidEqContext';
import SmartEqEngine from 'renderer/SmartEqEngine';
import { setSmartEqMode } from 'renderer/utils/smartEqMode';

jest.mock('renderer/utils/equalizerApi', () => ({
  getEqualizerState: jest.fn(),
  setSmartEq: jest.fn(() => Promise.resolve()),
}));

jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => ({
    captureBalanceProfile: jest.fn(() => new Promise(() => {})),
    isActive: false,
  }),
}));

const mockedGetEqualizerState = getEqualizerState as jest.Mock;
const mockedSetSmartEq = setSmartEqApi as jest.Mock;

/** A correction that is mostly cuts, which is the dangerous kind to drop. */
const withCorrection = () => {
  const state = getDefaultState();
  state.smartEq = {
    filters: {
      s1: {
        id: 's1',
        frequency: 120,
        gain: -7,
        quality: 1,
        type: FilterTypeEnum.PK,
      },
      s2: {
        id: 's2',
        frequency: 3000,
        gain: -5,
        quality: 1,
        type: FilterTypeEnum.PK,
      },
    },
  };
  return state;
};

/**
 * SWITCHING MODE MUST NEVER DROP THE CORRECTION.
 *
 * It used to, deliberately: the layer already applied was built for the old
 * reference, so clearing it stopped the new mode inheriting somebody else's
 * idea of right. The trouble is what that sounds like. Most corrections are
 * mostly cuts, because a record is more often too much of something than too
 * little, and removing them all in one config write raises the output by
 * however much they were holding down — instantly, with no ramp, on an
 * ordinary menu click. In front of an audience that is equipment and hearing.
 *
 * Every continuous mode is a closed loop over its own output, so an inherited
 * curve is measured, disagreed with, and moved. It costs convergence time.
 * Clearing costs a level jump, and only one of the two can be taken back.
 */
describe('switching Smart EQ mode', () => {
  beforeEach(() => {
    // The mode store reads localStorage, and the engine reaches the preload
    // bridge through the context. Neither exists in jsdom.
    Object.defineProperty(window, 'electron', {
      configurable: true,
      get: () => ({
        ipcRenderer: {
          sendMessage: () => {},
          on: () => () => {},
          once: () => {},
          removeListener: () => {},
        },
      }),
    });
    jest.clearAllMocks();
    mockedGetEqualizerState.mockResolvedValue(withCorrection());
    setSmartEqMode('smart');
  });

  afterEach(() => {
    setSmartEqMode('smart');
  });

  const renderEngine = async () => {
    await act(async () => {
      render(
        <FluidEqProvider>
          <SmartEqEngine />
        </FluidEqProvider>,
      );
    });
  };

  it('never clears the layer on the way into a continuous mode', async () => {
    await renderEngine();
    mockedSetSmartEq.mockClear();

    await act(async () => {
      setSmartEqMode('balance');
    });

    expect(mockedSetSmartEq).not.toHaveBeenCalledWith(undefined);
  });

  it('does not clear it moving between two continuous modes either', async () => {
    await renderEngine();

    await act(async () => {
      setSmartEqMode('target');
    });
    mockedSetSmartEq.mockClear();

    await act(async () => {
      setSmartEqMode('detail');
    });

    expect(mockedSetSmartEq).not.toHaveBeenCalledWith(undefined);
  });
});
