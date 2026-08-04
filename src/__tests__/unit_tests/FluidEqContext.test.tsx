/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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
import {
  FilterTypeEnum,
  getDefaultState,
  IFiltersMap,
  IState,
} from 'common/constants';
import { getEqualizerState } from 'renderer/utils/equalizerApi';
import {
  FilterActionEnum,
  FluidEqProvider,
  IFluidEqContext,
  useFluidEqContext,
} from 'renderer/utils/FluidEqContext';

jest.mock('renderer/utils/equalizerApi', () => ({
  getEqualizerState: jest.fn(),
}));

const mockedGetEqualizerState = getEqualizerState as jest.Mock;

/**
 * Eight bands, so the reveal is cut into eight frames of 60 ms each and the
 * last one lands around 420 ms in. Every test below interferes well before
 * that, with room to spare on a slow machine.
 */
const BAND_COUNT = 8;

const buildFilters = (gains: number[]): IFiltersMap => {
  const filters: IFiltersMap = {};
  gains.forEach((gain, index) => {
    const id = `band-${index}`;
    filters[id] = {
      id,
      frequency: 100 * (index + 1),
      gain,
      quality: 1,
      type: FilterTypeEnum.PK,
    };
  });
  return filters;
};

const stateWith = (filters: IFiltersMap): IState => ({
  ...getDefaultState(),
  filters,
});

const flat = () => buildFilters(new Array(BAND_COUNT).fill(0));
const tuned = () =>
  buildFilters(
    Array.from({ length: BAND_COUNT }, (_unused, index) => index + 1),
  );

const gainsById = (filters: IFiltersMap): Record<string, number> =>
  Object.fromEntries(
    Object.values(filters).map((filter) => [filter.id, filter.gain]),
  );

let latest: IFluidEqContext | undefined;

const Probe = () => {
  latest = useFluidEqContext();
  return null;
};

/** The context as of the last render, never a copy taken earlier. */
const context = () => latest as IFluidEqContext;

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

const mount = async () => {
  mockedGetEqualizerState.mockResolvedValue(stateWith(flat()));
  await act(async () => {
    render(
      <FluidEqProvider>
        <Probe />
      </FluidEqProvider>,
    );
  });
  mockedGetEqualizerState.mockResolvedValue(stateWith(tuned()));
};

describe('FluidEqProvider band reveal', () => {
  beforeEach(() => {
    latest = undefined;
    mockedGetEqualizerState.mockReset();
    Object.defineProperty(window, 'electron', {
      configurable: true,
      get: () => ({
        ipcRenderer: {
          on: () => () => {},
        },
      }),
    });
  });

  it('brings the whole tuning in when nothing interrupts it', async () => {
    await mount();

    await act(async () => {
      await context().refreshState({ revealBands: true });
    });

    expect(gainsById(context().filters)).toEqual(gainsById(tuned()));
  });

  // The reveal is stopped by ADD and REMOVE, but neither replaces the band
  // set: Equalizer APO and the saved profile are still playing the whole
  // reference, so anything the animation had not reached must land anyway.
  it('lands the rest of the tuning when a band is added mid-reveal', async () => {
    await mount();

    await act(async () => {
      const revealing = context().refreshState({ revealBands: true });
      await wait(80);
      context().dispatchFilter({
        type: FilterActionEnum.ADD,
        id: 'added',
        frequency: 12000,
      });
      await revealing;
    });

    expect(gainsById(context().filters)).toEqual({
      ...gainsById(tuned()),
      // A band the user just added is theirs, and main created it neutral.
      added: 0,
    });
  });

  it('lands the rest of the tuning when a band is deleted mid-reveal', async () => {
    await mount();

    await act(async () => {
      const revealing = context().refreshState({ revealBands: true });
      await wait(80);
      context().dispatchFilter({
        type: FilterActionEnum.REMOVE,
        id: `band-${BAND_COUNT - 1}`,
      });
      await revealing;
    });

    const expected = gainsById(tuned());
    delete expected[`band-${BAND_COUNT - 1}`];
    expect(gainsById(context().filters)).toEqual(expected);
  });

  // The other kind of interruption. A second reference, Clear EQ and an output
  // switch all arrive as an INIT, and what they brought is whole — asserting
  // the remainder of the old reveal over it would be writing back a tuning
  // nobody is looking at.
  it('leaves a replacement band set alone', async () => {
    await mount();
    const replacement = buildFilters([-2]);

    await act(async () => {
      const revealing = context().refreshState({ revealBands: true });
      await wait(80);
      context().dispatchFilter({
        type: FilterActionEnum.INIT,
        filters: replacement,
      });
      await revealing;
    });

    expect(gainsById(context().filters)).toEqual({ 'band-0': -2 });
  });

  // The band is already at the user's value in the main process by the time
  // this dispatch lands, so repainting the reference over it in the renderer
  // alone would leave the editor showing a gain APO is not playing.
  it('does not paint the reference over a band edited during the reveal', async () => {
    await mount();
    const editedId = `band-${BAND_COUNT - 1}`;

    await act(async () => {
      const revealing = context().refreshState({ revealBands: true });
      await wait(20);
      context().dispatchFilter({
        type: FilterActionEnum.GAIN,
        id: editedId,
        newValue: -3,
      });
      await revealing;
    });

    expect(context().filters[editedId].gain).toBe(-3);
    expect(context().filters['band-0'].gain).toBe(1);
  });

  it('keeps a mid-reveal edit when the reveal is then cut short', async () => {
    await mount();
    const editedId = `band-${BAND_COUNT - 1}`;

    await act(async () => {
      const revealing = context().refreshState({ revealBands: true });
      await wait(20);
      context().dispatchFilter({
        type: FilterActionEnum.GAIN,
        id: editedId,
        newValue: -3,
      });
      context().dispatchFilter({
        type: FilterActionEnum.ADD,
        id: 'added',
        frequency: 12000,
      });
      await revealing;
    });

    expect(context().filters[editedId].gain).toBe(-3);
    // Everything the animation never got to still lands.
    expect(context().filters['band-4'].gain).toBe(5);
  });

  it('does not treat a reveal as an edit of the bands it has already shown', async () => {
    await mount();

    await act(async () => {
      await context().refreshState({ revealBands: true });
      // A second reveal of the same tuning: if the first had recorded its own
      // frames as user edits the ref would still be holding them.
      await context().refreshState({ revealBands: true });
    });

    expect(gainsById(context().filters)).toEqual(gainsById(tuned()));
  });
});
