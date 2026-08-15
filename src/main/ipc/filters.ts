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

import { ipcMain } from 'electron';
import {
  FilterTypeEnum,
  FixedBandSizeEnum,
  IFilter,
  IFilterEdit,
  IFiltersMap,
  IState,
  MAX_FREQUENCY,
  MAX_GAIN,
  MAX_NUM_FILTERS,
  MAX_QUALITY,
  MIN_FREQUENCY,
  MIN_GAIN,
  MIN_NUM_FILTERS,
  MIN_QUALITY,
  getDefaultFilterWithId,
  getDefaultFilters,
} from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import { PRODUCT_NAME } from '../../common/branding';
import ChannelEnum from '../../common/channels';
import {
  ILayoutSnapshot,
  adaptLayoutToFixedFrequencies,
  snapshotFilters,
} from '../../common/layouts';
import { isFixedBandSizeEnumValue } from '../../common/utils';
import { TSuccess } from '../../renderer/utils/equalizerApi';

/**
 * Everything these handlers may touch, stated rather than implied.
 *
 * In `main.ts` each of these was a module-level name, which meant every one of
 * eighty-five handlers could reach all of them and the only way to know what a
 * given handler used was to read it. That is not a stylistic complaint: the
 * preamp bug this release fixed twice was two writers disagreeing about one
 * field, and they were hundreds of lines apart in a scope that let them both in.
 *
 * `state` is passed by reference and mutated in place, which is what the rest of
 * the process expects — the point of this interface is not to make the state
 * immutable, it is to make reaching it visible in a signature.
 */
export interface IFiltersIpcDeps {
  state: IState;
  handleUpdate: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  handleUpdateHelper: <T>(
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    response: T,
    syncActiveProfile?: boolean,
    useActiveSessionOverride?: boolean,
  ) => Promise<void>;
  handleError: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    message?: string,
    action?: string,
  ) => void;
  doesFilterIdExist: (
    event: Electron.IpcMainEvent,
    channel: ChannelEnum,
    filterId: string,
  ) => boolean;
  /** Remember where the current bands sit, before the count changes. */
  captureCurrentLayout: () => void;
  getStoredLayout: (size: FixedBandSizeEnum) => ILayoutSnapshot | undefined;
  resetEqToDefaults: () => void;
  switchToParametricEditing: () => void;
}

/**
 * The bands themselves: gain, frequency, Q, type, and how many there are.
 *
 * One subject, and it was already written as one contiguous run of handlers —
 * this move gave it a file rather than inventing a grouping.
 */
export const registerFiltersIpc = ({
  state,
  handleUpdate,
  handleUpdateHelper,
  handleError,
  doesFilterIdExist,
  captureCurrentLayout,
  getStoredLayout,
  resetEqToDefaults,
  switchToParametricEditing,
}: IFiltersIpcDeps) => {
  ipcMain.on(ChannelEnum.GET_FILTER_GAIN, async (event, arg) => {
    const channel = ChannelEnum.GET_FILTER_GAIN;
    const filterId = arg[0];

    // Filter id must exist
    if (!doesFilterIdExist(event, channel, filterId)) {
      return;
    }

    const reply: TSuccess<number> = {
      result: state.filters[filterId].gain || 0,
    };
    event.reply(channel + filterId, reply);
  });

  ipcMain.on(ChannelEnum.SET_FILTER_GAIN, async (event, arg) => {
    const channel = ChannelEnum.SET_FILTER_GAIN;
    const filterId = arg[0];
    const gain = parseFloat(arg[1]) || 0;

    // Filter id must exist
    if (!doesFilterIdExist(event, channel, filterId)) {
      return;
    }

    if (gain < MIN_GAIN || gain > MAX_GAIN) {
      handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
      return;
    }

    switchToParametricEditing();
    state.filters[filterId].gain = gain;
    state.isFlat = false;
    await handleUpdate(event, channel + filterId, false, true);
  });

  ipcMain.on(ChannelEnum.GET_FILTER_FREQUENCY, async (event, arg) => {
    const channel = ChannelEnum.GET_FILTER_FREQUENCY;
    const filterId = arg[0];

    // Filter id must exist
    if (!doesFilterIdExist(event, channel, filterId)) {
      return;
    }

    const reply: TSuccess<number> = {
      result: state.filters[filterId].frequency || 10,
    };
    event.reply(channel + filterId, reply);
  });

  ipcMain.on(ChannelEnum.SET_FILTER_FREQUENCY, async (event, arg) => {
    const channel = ChannelEnum.SET_FILTER_FREQUENCY;
    const filterId = arg[0];
    const frequency = parseInt(arg[1], 10) || 0;

    // Filter id must exist
    if (!doesFilterIdExist(event, channel, filterId)) {
      return;
    }

    if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
      handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
      return;
    }

    switchToParametricEditing();
    state.filters[filterId].frequency = frequency;
    state.isFlat = false;
    await handleUpdate(event, channel + filterId, false, true);
  });

  ipcMain.on(ChannelEnum.GET_FILTER_QUALITY, async (event, arg) => {
    const channel = ChannelEnum.GET_FILTER_QUALITY;
    const filterId = arg[0];

    // Filter id must exist
    if (!doesFilterIdExist(event, channel, filterId)) {
      return;
    }

    const reply: TSuccess<number> = {
      result: state.filters[filterId].quality || 10,
    };
    event.reply(channel + filterId, reply);
  });

  ipcMain.on(ChannelEnum.SET_FILTER_QUALITY, async (event, arg) => {
    const channel = ChannelEnum.SET_FILTER_QUALITY;
    const filterId = arg[0];
    const quality = parseFloat(arg[1]) || 0;

    // Filter id must exist
    if (!doesFilterIdExist(event, channel, filterId)) {
      return;
    }

    if (quality < MIN_QUALITY || quality > MAX_QUALITY) {
      handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
      return;
    }

    switchToParametricEditing();
    state.filters[filterId].quality = quality;
    state.isFlat = false;
    await handleUpdate(event, channel + filterId, false, true);
  });

  ipcMain.on(ChannelEnum.GET_FILTER_TYPE, async (event, arg) => {
    const channel = ChannelEnum.GET_FILTER_TYPE;
    const filterId = arg[0];

    // Filter id must exist
    if (!doesFilterIdExist(event, channel, filterId)) {
      return;
    }

    const reply: TSuccess<string> = {
      result: state.filters[filterId].type,
    };
    event.reply(channel + filterId, reply);
  });

  ipcMain.on(ChannelEnum.SET_FILTER_TYPE, async (event, arg) => {
    const channel = ChannelEnum.SET_FILTER_TYPE;
    const filterId = arg[0];
    const filterType = arg[1];

    // Filter id must exist
    if (!doesFilterIdExist(event, channel, filterId)) {
      return;
    }

    if (!Object.values(FilterTypeEnum).includes(filterType)) {
      handleError(event, channel + filterId, ErrorCode.INVALID_PARAMETER);
      return;
    }

    switchToParametricEditing();
    state.filters[filterId].type = filterType as FilterTypeEnum;
    state.isFlat = false;
    await handleUpdate(event, channel + filterId, false, true);
  });

  /**
   * Apply a whole group edit, then flush once.
   *
   * The single-band setters above are unchanged and still the right thing for a
   * single band. This exists because the flush is the expensive half: sending it
   * per band made a ten-band selection ten installation checks, ten retried
   * config writes and ten preset saves for one movement of one control.
   *
   * All-or-nothing on validation. A batch that names a band that no longer
   * exists, or carries a value out of range, is rejected before anything is
   * written — half an edit reaching Equalizer APO would leave the config and the
   * window disagreeing about what is playing, with nothing to say which bands
   * made it.
   */
  ipcMain.on(ChannelEnum.SET_FILTER_VALUES, async (event, arg) => {
    const channel = ChannelEnum.SET_FILTER_VALUES;
    const edits: IFilterEdit[] = Array.isArray(arg?.[0]) ? arg[0] : [];

    if (edits.length === 0) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    const isInRange = (value: number | undefined, min: number, max: number) =>
      value === undefined ||
      (Number.isFinite(value) && value >= min && value <= max);

    const isValid = edits.every(
      (edit) =>
        typeof edit?.id === 'string' &&
        edit.id in state.filters &&
        isInRange(edit.gain, MIN_GAIN, MAX_GAIN) &&
        isInRange(edit.frequency, MIN_FREQUENCY, MAX_FREQUENCY) &&
        isInRange(edit.quality, MIN_QUALITY, MAX_QUALITY) &&
        (edit.type === undefined ||
          Object.values(FilterTypeEnum).includes(edit.type)),
    );

    if (!isValid) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    switchToParametricEditing();
    edits.forEach((edit) => {
      const filter = state.filters[edit.id];
      if (edit.frequency !== undefined) {
        filter.frequency = edit.frequency;
      }
      if (edit.gain !== undefined) {
        filter.gain = edit.gain;
      }
      if (edit.quality !== undefined) {
        filter.quality = edit.quality;
      }
      if (edit.type !== undefined) {
        filter.type = edit.type;
      }
    });
    state.isFlat = false;
    await handleUpdate(event, channel, false, true);
  });

  ipcMain.on(ChannelEnum.GET_FILTER_COUNT, async (event) => {
    const reply: TSuccess<number> = {
      result: Object.keys(state.filters).length,
    };
    event.reply(ChannelEnum.GET_FILTER_COUNT, reply);
  });

  ipcMain.on(ChannelEnum.ADD_FILTER, async (event, arg) => {
    const channel = ChannelEnum.ADD_FILTER;
    const frequency: number = arg[0];

    // Two different refusals, and they were reported as the same "Internal
    // Error: Invalid parameter — please reach out to the developers". Neither is
    // an internal error and neither needs a developer: one is a documented limit
    // and the other is a number outside the audible range.
    if (Object.keys(state.filters).length >= MAX_NUM_FILTERS) {
      handleError(
        event,
        channel,
        ErrorCode.INVALID_PARAMETER,
        `You already have the most bands ${PRODUCT_NAME} can apply (${MAX_NUM_FILTERS}).`,
        'Remove a band before adding another, or adjust one you already have.',
      );
      return;
    }
    if (frequency < MIN_FREQUENCY || frequency > MAX_FREQUENCY) {
      handleError(
        event,
        channel,
        ErrorCode.INVALID_PARAMETER,
        `A band has to sit between ${MIN_FREQUENCY} Hz and ${MAX_FREQUENCY} Hz.`,
        'Nothing was added. Pick a frequency inside that range.',
      );
      return;
    }

    switchToParametricEditing();
    const newFilter: IFilter = { ...getDefaultFilterWithId(), frequency };
    state.filters[newFilter.id] = newFilter;
    state.isFlat = false;
    await handleUpdateHelper(event, channel, newFilter.id, false, true);
  });

  ipcMain.on(ChannelEnum.REMOVE_FILTER, async (event, arg) => {
    const channel = ChannelEnum.REMOVE_FILTER;
    const filterId: string = arg[0];

    // Cannot fall below the minimum number of filters
    if (Object.keys(state.filters).length <= MIN_NUM_FILTERS) {
      handleError(
        event,
        channel,
        ErrorCode.INVALID_PARAMETER,
        MIN_NUM_FILTERS === 1
          ? 'An equalizer needs at least one band.'
          : `An equalizer needs at least ${MIN_NUM_FILTERS} bands.`,
        'Set its gain to 0 dB instead — that leaves the sound untouched.',
      );
      return;
    }

    // Filter id must exist
    if (!doesFilterIdExist(event, channel, filterId)) {
      return;
    }

    switchToParametricEditing();
    // delete does not throw exception even if the filterId does not exist
    delete state.filters[filterId];
    state.isFlat = false;
    await handleUpdate(event, channel, false, true);
  });

  ipcMain.on(ChannelEnum.CLEAR_GAINS, async (event) => {
    const channel = ChannelEnum.CLEAR_GAINS;

    resetEqToDefaults();

    // EQ reset is independent from convolution. Persist the resulting state
    // (including any active convolution) to the device profile so APO keeps the
    // impulse response enabled after the EQ bands are cleared.
    await handleUpdateHelper<IFiltersMap>(
      event,
      channel,
      state.filters,
      false,
      true,
    );
  });

  ipcMain.on(ChannelEnum.SET_FIXED_BAND, async (event, arg) => {
    const channel = ChannelEnum.SET_FIXED_BAND;
    const size: FixedBandSizeEnum = arg[0];
    if (!isFixedBandSizeEnumValue(size)) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }

    // Capture the high-resolution layout before replacing it. The snapshot is
    // device-scoped and survives app restarts, so returning to a previous band
    // count restores its original frequencies and tuning.
    captureCurrentLayout();
    const sourceSnapshot = snapshotFilters(state.filters);
    switchToParametricEditing();
    const storedSnapshot = getStoredLayout(size);
    const targetSnapshot =
      storedSnapshot || adaptLayoutToFixedFrequencies(sourceSnapshot, size);
    const nextFilters = getDefaultFilters(size);
    Object.values(nextFilters)
      .sort((left, right) => left.frequency - right.frequency)
      .forEach((filter, index) => {
        const savedBand = targetSnapshot[index];
        if (!savedBand) {
          return;
        }
        filter.frequency = savedBand.frequency;
        filter.gain = savedBand.gain;
        filter.quality = savedBand.quality;
        filter.type = savedBand.type;
      });
    state.filters = nextFilters;
    state.isFlat = false;

    await handleUpdateHelper<IFiltersMap>(
      event,
      channel,
      state.filters,
      false,
      true,
    );
  });
};
