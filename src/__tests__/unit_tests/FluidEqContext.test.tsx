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

/**
 * The reducer action behind a group edit.
 *
 * Every one of these is a way a group edit can arrive already out of date:
 * it is dispatched from a throttled timer, so between the drag frame that
 * built the list and the moment it lands, bands can be deleted and values can
 * have moved to where the batch was going to put them anyway.
 */
describe('FluidEqProvider group edits', () => {
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

  it('applies every band in one commit', async () => {
    await mount();

    await act(async () => {
      context().dispatchFilter({
        type: FilterActionEnum.EDITS,
        edits: [
          { id: 'band-0', gain: -4 },
          { id: 'band-1', gain: 6 },
          { id: 'band-2', quality: 2.5 },
        ],
      });
    });

    expect(context().filters['band-0'].gain).toBe(-4);
    expect(context().filters['band-1'].gain).toBe(6);
    expect(context().filters['band-2'].quality).toBe(2.5);
  });

  // A group edit names one parameter; the bands' other values are not its
  // business and a missing field must not be read as "set this to nothing".
  it('leaves the fields an edit does not mention alone', async () => {
    await mount();
    const before = context().filters['band-3'];

    await act(async () => {
      context().dispatchFilter({
        type: FilterActionEnum.EDITS,
        edits: [{ id: 'band-3', gain: 5 }],
      });
    });

    const after = context().filters['band-3'];
    expect(after.gain).toBe(5);
    expect(after.frequency).toBe(before.frequency);
    expect(after.quality).toBe(before.quality);
    expect(after.type).toBe(before.type);
  });

  it('drops bands that no longer exist rather than resurrecting them', async () => {
    await mount();

    await act(async () => {
      context().dispatchFilter({
        type: FilterActionEnum.REMOVE,
        id: 'band-2',
      });
      context().dispatchFilter({
        type: FilterActionEnum.EDITS,
        edits: [
          { id: 'band-2', gain: -9 },
          { id: 'band-3', gain: -9 },
        ],
      });
    });

    expect(context().filters['band-2']).toBeUndefined();
    expect(context().filters['band-3'].gain).toBe(-9);
  });

  // Identity matters: the response graph re-reads the whole tuning whenever
  // the map changes, and its auto-headroom writes Equalizer APO's preamp for
  // every tuning it is shown.
  it('returns the same map when the edit asks for nothing', async () => {
    await mount();
    const before = context().filters;

    await act(async () => {
      context().dispatchFilter({
        type: FilterActionEnum.EDITS,
        edits: [{ id: 'band-0', gain: before['band-0'].gain }],
      });
    });

    expect(context().filters).toBe(before);
  });
});

/**
 * A reference that corrects nothing still leaves an equaliser.
 *
 * A flat target contains no filters at all, which is a perfectly good answer to
 * "what should be corrected" and a terrible one to "what should the editor
 * show". Applying one used to hand the band set an empty map, and the whole
 * slider row disappeared.
 */
describe('FluidEqProvider empty band sets', () => {
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

  it('keeps the bands already on screen when a refresh brings none', async () => {
    await mount();
    mockedGetEqualizerState.mockResolvedValue(stateWith({}));

    await act(async () => {
      await context().refreshState();
    });

    // The layout that was there, not a fresh default one: somebody who pulled
    // thirty-one bands to zero still has thirty-one bands.
    expect(Object.keys(context().filters).sort()).toEqual(
      Object.keys(flat()).sort(),
    );
  });

  it('does the same when the bands are being revealed', async () => {
    await mount();
    mockedGetEqualizerState.mockResolvedValue(stateWith({}));

    await act(async () => {
      await context().refreshState({ revealBands: true });
    });

    expect(Object.keys(context().filters).length).toBeGreaterThan(0);
  });

  it('leaves a real band set exactly as it arrived', async () => {
    await mount();
    mockedGetEqualizerState.mockResolvedValue(stateWith(tuned()));

    await act(async () => {
      await context().refreshState();
    });

    expect(gainsById(context().filters)).toEqual(gainsById(tuned()));
  });
});
