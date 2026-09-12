import fs from 'fs';
import os from 'os';
import path from 'path';
import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultFilterWithId,
  getDefaultState,
} from 'common/constants';
import { cloneBandDesign } from 'common/bandDesigns';
import registerBandDesignsIpc from 'main/ipc/bandDesigns';
import { registerFiltersIpc } from 'main/ipc/filters';
import { readBandDesigns, writeBandDesign } from 'main/bandDesignStore';

type Handler = (event: { reply: jest.Mock }, args?: unknown) => Promise<void>;
const handlers = new Map<string, Handler>();
jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
}));
const design = {
  id: 'custom',
  name: 'Custom',
  bands: [{ frequency: 87, quality: 3.2 }],
};

describe('band design and clear commands', () => {
  let directory: string;
  let state = getDefaultState();
  const event = { reply: jest.fn() };
  const update = jest.fn();
  const error = jest.fn();
  const capture = jest.fn();
  const switchEditing = jest.fn();
  const send = async (channel: ChannelEnum, args?: unknown) => {
    const handler = handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler for ${channel}`);
    }
    await handler(event, args);
  };
  beforeEach(() => {
    jest.clearAllMocks();
    handlers.clear();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-band-ipc-'));
    state = getDefaultState();
    state.eqMode = 'double';
    state.curveEqMode = 'studio';
    state.eqBandQ = 'proportional';
    state.preAmp = -9;
    const deps = {
      state,
      handleUpdateHelper: update,
      handleError: error,
      switchToParametricEditing: switchEditing,
      captureCurrentLayout: capture,
    };
    registerBandDesignsIpc({ ...deps, userDataDir: directory });
    registerFiltersIpc({
      ...deps,
      handleUpdate: update,
      doesFilterIdExist: () => true,
      getStoredLayout: () => undefined,
    });
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('saves and updates a frequency/Q snapshot without changing any sound settings', async () => {
    Object.values(state.filters)[0].gain = 8;
    Object.values(state.filters)[0].quality = 4.7;
    const before = JSON.parse(JSON.stringify(state));
    await send(ChannelEnum.SAVE_BAND_DESIGN, ['My design']);
    const saved = readBandDesigns(directory)[0];
    expect(saved.name).toBe('My design');
    expect(saved.bands).toHaveLength(Object.keys(state.filters).length);
    expect(saved.bands).toContainEqual({
      frequency: Object.values(state.filters)[0].frequency,
      quality: 4.7,
    });
    expect(state).toEqual({ ...before, eqBandDesign: saved });
    expect(capture).not.toHaveBeenCalled();
    expect(switchEditing).not.toHaveBeenCalled();
    Object.values(state.filters)[0].quality = 7;
    await send(ChannelEnum.SAVE_BAND_DESIGN, ['My design', saved.id]);
    expect(readBandDesigns(directory)).toHaveLength(1);
    expect(readBandDesigns(directory)[0].bands).toContainEqual({
      frequency: Object.values(state.filters)[0].frequency,
      quality: 7,
    });
  });

  it('loads saved frequency/Q at neutral gains without changing either EQ mode or preamp', async () => {
    writeBandDesign(directory, design);
    await send(ChannelEnum.APPLY_BAND_DESIGN, [design.id]);
    expect(Object.values(state.filters)).toEqual([
      expect.objectContaining({
        frequency: 87,
        quality: 3.2,
        gain: 0,
        type: FilterTypeEnum.PK,
      }),
    ]);
    expect(state).toMatchObject({
      eqBandDesign: design,
      eqMode: 'double',
      curveEqMode: 'studio',
      eqBandQ: 'proportional',
      preAmp: -9,
    });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(switchEditing).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });

  it('deletes a selected design without changing the current bands or sound settings', async () => {
    writeBandDesign(directory, design);
    state.eqBandDesign = cloneBandDesign(design);
    Object.values(state.filters)[0].gain = 7;
    const before = { ...state, eqBandDesign: undefined };
    await send(ChannelEnum.DELETE_BAND_DESIGN, [design.id]);
    expect(readBandDesigns(directory)).toEqual([]);
    expect(state).toEqual(before);
    expect(update).toHaveBeenLastCalledWith(
      event,
      ChannelEnum.DELETE_BAND_DESIGN,
      true,
      false,
      true,
    );
  });

  it.each([16, 31])(
    'Empty EQ only zeros gains for %i current bands, never restores a saved layout',
    async (count) => {
      state.filters = Object.fromEntries(
        Array.from({ length: count }, (_, index) => {
          const filter = {
            ...getDefaultFilterWithId(),
            frequency: 70 + index * 200,
            gain: index % 2 === 0 ? 5 : -3,
            quality: 0.7 + index / 10,
            type: index === 0 ? FilterTypeEnum.HSC : FilterTypeEnum.PK,
            isEnabled: index !== 2,
          };
          return [filter.id, filter];
        }),
      );
      state.eqBandDesign = cloneBandDesign(design);
      state.headphone = {
        filters: {
          correction: {
            ...getDefaultFilterWithId(),
            id: 'correction',
            gain: 4,
          },
        },
        intensity: 1,
      };
      const expected = JSON.parse(JSON.stringify(state));
      Object.values(expected.filters as typeof state.filters).forEach(
        (filter) => {
          filter.gain = 0;
        },
      );
      expected.isFlat = false;
      await send(ChannelEnum.CLEAR_GAINS);
      expect(state).toEqual(expected);
      expect(switchEditing).not.toHaveBeenCalled();
      expect(capture).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledTimes(1);
    },
  );

  it('flattens sampled points without replacing their frequencies or format', async () => {
    state.eqFormat = AutoEqFormat.GRAPHIC;
    state.graphicEq = [
      { frequency: 51, gain: 7 },
      { frequency: 975, gain: -3 },
    ];
    await send(ChannelEnum.CLEAR_GAINS);
    expect(state.graphicEq).toEqual([
      { frequency: 51, gain: 0 },
      { frequency: 975, gain: 0 },
    ]);
    expect(state.eqFormat).toBe(AutoEqFormat.GRAPHIC);
  });

  it('rejects unknown selections and invalid names before touching tuning or files', async () => {
    const before = JSON.stringify(state);
    await send(ChannelEnum.APPLY_BAND_DESIGN, ['missing']);
    await send(ChannelEnum.SAVE_BAND_DESIGN, [' ']);
    await send(ChannelEnum.SAVE_BAND_DESIGN, ['Fine', 'missing']);
    await send(ChannelEnum.DELETE_BAND_DESIGN, [false]);
    expect(error).toHaveBeenCalledTimes(4);
    expect(error).toHaveBeenLastCalledWith(
      event,
      ChannelEnum.DELETE_BAND_DESIGN,
      ErrorCode.INVALID_PARAMETER,
    );
    expect(JSON.stringify(state)).toBe(before);
    expect(fs.readdirSync(directory)).toEqual([]);
  });
});
