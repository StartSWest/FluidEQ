/*
<FluidEQ: System-wide parametric audio equalizer interface>
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
import { ReactElement } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import AutoEQ from 'renderer/AutoEQ';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import {
  getAutoEqDeviceList,
  getAutoEqResponseList,
  getSquiglinkDeviceList,
  getSquiglinkResponseList,
  checkAutoEqUpdate,
} from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/equalizerApi', () => ({
  getAutoEqDeviceList: jest.fn(),
  getAutoEqResponseList: jest.fn(),
  loadAutoEqPreset: jest.fn(),
  getSquiglinkDeviceList: jest.fn(),
  getSquiglinkResponseList: jest.fn(),
  loadSquiglinkPreset: jest.fn(),
  checkAutoEqUpdate: jest.fn(),
  clearHeadset: jest.fn(),
  updateAutoEqDatabase: jest.fn(),
}));

const mockAutoEqDevices = getAutoEqDeviceList as jest.Mock;
const mockAutoEqResponses = getAutoEqResponseList as jest.Mock;
const mockSquigDevices = getSquiglinkDeviceList as jest.Mock;
const mockSquigResponses = getSquiglinkResponseList as jest.Mock;
const mockCheckUpdate = checkAutoEqUpdate as jest.Mock;

const SQUIG_SOURCE_ID = 'squiglink-gadgetrytech-headphones-headsets';
const AUTOEQ_SOURCE_NAME = 'AutoEq official';
const SQUIG_SOURCE_NAME = 'Squiglink / GadgetryTech';

// The same model measured by both databases, which is the case the source id
// exists to disambiguate: the measurement names behind the two are unrelated,
// so resolving to the wrong one cannot restore the target at all.
const SHARED_MODEL = 'HD 600';
const AUTOEQ_TARGET = 'HD 600 ParametricEQ';
const SQUIG_TARGET = 'Harman over-ear 2018';

/**
 * Drive whatever the panel started to completion, inside one act window.
 *
 * Restoring a selection is several awaits deep — the device lists, then the
 * applied model's measurement list — and every one of those continuations
 * writes state. Draining them between act windows, which is what waitFor and a
 * loop of empty acts both do, means React sees those writes with no act in
 * scope and warns about every one of them.
 */
const settle = async () => {
  for (let level = 0; level < 8; level += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

/** Run something and let it finish, all within a single act window. */
const actAndSettle = (body: () => void) =>
  act(async () => {
    body();
    await settle();
  });

describe('AutoEQ', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoEqDevices.mockResolvedValue([SHARED_MODEL]);
    mockSquigDevices.mockResolvedValue([SHARED_MODEL]);
    mockAutoEqResponses.mockResolvedValue([AUTOEQ_TARGET]);
    mockSquigResponses.mockResolvedValue([SQUIG_TARGET, 'Diffuse field']);
    mockCheckUpdate.mockRejectedValue(new Error('offline'));

    Object.defineProperty(window, 'electron', {
      configurable: true,
      // The panel subscribes to the startup database sync broadcast, and `on`
      // has to hand back an unsubscribe function or the cleanup throws.
      get: () => ({
        ipcRenderer: {
          sendMessage: () => {},
          on: () => () => {},
          once: () => {},
          removeListener: () => {},
        },
      }),
    });
  });

  const panelWith = (overrides: Partial<IFluidEqContext>): ReactElement => (
    <FluidEqProviderWrapper value={{ ...defaultFluidEqContext, ...overrides }}>
      <AutoEQ />
    </FluidEqProviderWrapper>
  );

  const renderPanel = async (overrides: Partial<IFluidEqContext>) => {
    let result!: ReturnType<typeof render>;
    await actAndSettle(() => {
      result = render(panelWith(overrides));
    });
    return result;
  };

  const sourceMenu = () =>
    screen.getByRole('menu', { name: 'Measurement source' });
  const modelMenu = () => screen.getByRole('menu', { name: 'Audio Device' });
  const targetMenu = () =>
    screen.getByRole('menu', { name: 'Target Frequency Response' });

  it('puts an applied reference back into all three pickers', async () => {
    await renderPanel({
      headset: SHARED_MODEL,
      headsetTarget: SQUIG_TARGET,
      headsetSource: SQUIG_SOURCE_ID,
    });

    expect(
      within(sourceMenu()).getByText(SQUIG_SOURCE_NAME),
    ).toBeInTheDocument();
    expect(within(modelMenu()).getByText(SHARED_MODEL)).toBeInTheDocument();
    expect(
      within(modelMenu()).getByText(SQUIG_SOURCE_NAME),
    ).toBeInTheDocument();
    expect(within(targetMenu()).getByText(SQUIG_TARGET)).toBeInTheDocument();

    // The whole point of recording the source: the model name alone would have
    // matched the AutoEq copy, whose measurement list can never contain the
    // applied target.
    expect(mockAutoEqDevices).not.toHaveBeenCalled();
    expect(mockSquigResponses).toHaveBeenCalledWith(
      SQUIG_SOURCE_ID,
      SHARED_MODEL,
    );
  });

  it('says the reference is applied once the pickers agree with it', async () => {
    await renderPanel({
      headset: SHARED_MODEL,
      headsetTarget: SQUIG_TARGET,
      headsetSource: SQUIG_SOURCE_ID,
    });

    expect(screen.getByText('Applied')).toBeInTheDocument();
  });

  it('restores a profile written before the source was recorded', async () => {
    // Only the model name on disk, so the match has to fall back to the name
    // and the source picker has to stay on "All databases" rather than select
    // an id it does not have.
    await renderPanel({
      headset: SHARED_MODEL,
      headsetTarget: AUTOEQ_TARGET,
      headsetSource: undefined,
    });

    expect(within(sourceMenu()).getByText('All databases')).toBeInTheDocument();
    expect(within(modelMenu()).getByText(SHARED_MODEL)).toBeInTheDocument();
    expect(
      within(modelMenu()).getByText(AUTOEQ_SOURCE_NAME),
    ).toBeInTheDocument();
    expect(mockAutoEqResponses).toHaveBeenCalledWith(SHARED_MODEL);
    expect(within(targetMenu()).getByText(AUTOEQ_TARGET)).toBeInTheDocument();
  });

  it('leaves the measurement blank when it is gone from the database', async () => {
    mockSquigResponses.mockResolvedValue(['Diffuse field']);

    await renderPanel({
      headset: SHARED_MODEL,
      headsetTarget: SQUIG_TARGET,
      headsetSource: SQUIG_SOURCE_ID,
    });

    expect(within(modelMenu()).getByText(SHARED_MODEL)).toBeInTheDocument();
    // Not the neighbouring measurement, which would name a tuning that is not
    // the one in the bands.
    expect(within(targetMenu()).queryByText('Diffuse field')).toBeNull();
    expect(
      within(targetMenu()).getByText('Pick a response! 🔊'),
    ).toBeInTheDocument();
  });

  it('drops the model and measurement when the reference is cleared', async () => {
    const { rerender } = await renderPanel({
      headset: SHARED_MODEL,
      headsetTarget: SQUIG_TARGET,
      headsetSource: SQUIG_SOURCE_ID,
    });
    expect(within(modelMenu()).getByText(SHARED_MODEL)).toBeInTheDocument();

    // Clearing now takes the bands with it, so a model left in the picker
    // would name a tuning that no longer exists.
    await actAndSettle(() => {
      rerender(
        panelWith({
          headset: undefined,
          headsetTarget: undefined,
          headsetSource: undefined,
        }),
      );
    });

    expect(
      within(modelMenu()).getByText('Pick a device first! 🎧'),
    ).toBeInTheDocument();
    expect(
      within(targetMenu()).getByText('No supported responses 😞'),
    ).toBeInTheDocument();
    // The source is where you are browsing, not what is applied, so it stays.
    expect(
      within(sourceMenu()).getByText(SQUIG_SOURCE_NAME),
    ).toBeInTheDocument();
  });

  it('does not put the source back after the user changes it', async () => {
    const applied = {
      headset: SHARED_MODEL,
      headsetTarget: SQUIG_TARGET,
      headsetSource: SQUIG_SOURCE_ID,
    };
    const { rerender } = await renderPanel(applied);

    // fireEvent rather than user-event: the clicks here are only a way to get
    // at the picker's own change handler, and user-event schedules its work on
    // timers that land outside the act window this test controls.
    await actAndSettle(() => {
      fireEvent.click(sourceMenu());
    });
    await actAndSettle(() => {
      fireEvent.click(screen.getByRole('menuitem', { name: 'All databases' }));
    });
    expect(within(sourceMenu()).getByText('All databases')).toBeInTheDocument();

    // Every refreshState re-renders this with the same applied reference —
    // after an output change, after a save. None of them may undo the choice.
    await actAndSettle(() => {
      rerender(panelWith(applied));
    });
    expect(within(sourceMenu()).getByText('All databases')).toBeInTheDocument();
  });
});
