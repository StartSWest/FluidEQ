import fs from 'fs';
import os from 'os';
import path from 'path';
import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import {
  AutoEqFormat,
  FIXED_BAND_FREQUENCIES,
  FilterTypeEnum,
  FixedBandSizeEnum,
  getDefaultFilterWithId,
  getDefaultState,
} from 'common/constants';
import { qualitiesForRack } from 'common/bandQuality';
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
  const switchEditing = jest.fn();
  const release = jest.fn();
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
    };
    registerBandDesignsIpc({ ...deps, userDataDir: directory });
    registerFiltersIpc({
      ...deps,
      handleUpdate: update,
      doesFilterIdExist: () => true,
      applyingLayer: release,
    });
  });
  afterEach(() => fs.rmSync(directory, { recursive: true, force: true }));

  it('saves and updates a frequency/Q snapshot without changing any sound settings', async () => {
    Object.assign(state, { mainBandQ: 'asymmetric' });
    Object.values(state.filters)[0].gain = 8;
    Object.values(state.filters)[0].quality = 4.7;
    const before = JSON.parse(JSON.stringify(state));
    await send(ChannelEnum.SAVE_BAND_DESIGN, ['My design']);
    const saved = readBandDesigns(directory)[0];
    expect(saved.name).toBe('My design');
    expect(saved).toMatchObject({ bandQ: 'asymmetric' });
    expect(saved.bands).toHaveLength(Object.keys(state.filters).length);
    expect(saved.bands).toContainEqual({
      frequency: Object.values(state.filters)[0].frequency,
      quality: 4.7,
    });
    expect(state).toEqual({ ...before, eqBandDesign: saved });
    expect(switchEditing).not.toHaveBeenCalled();
    Object.values(state.filters)[0].quality = 7;
    Object.assign(state, { mainBandQ: 'off' });
    await send(ChannelEnum.SAVE_BAND_DESIGN, ['My design', saved.id]);
    expect(readBandDesigns(directory)).toHaveLength(1);
    expect(readBandDesigns(directory)[0].bands).toContainEqual({
      frequency: Object.values(state.filters)[0].frequency,
      quality: 7,
    });
    expect(readBandDesigns(directory)[0]).toMatchObject({ bandQ: 'off' });
  });

  it('restores the main Q behavior without changing any curve settings', async () => {
    const withMode = { ...design, bandQ: 'asymmetric' as const };
    writeBandDesign(directory, withMode);
    await send(ChannelEnum.APPLY_BAND_DESIGN, [design.id]);
    expect(state).toMatchObject({
      mainBandQ: 'asymmetric',
      eqBandQ: 'proportional',
      curveEqMode: 'studio',
      eqMode: 'double',
      preAmp: -9,
    });
  });

  it.each([100, 101, 9000])(
    'adds a band at %s Hz using the existing band Q',
    async (frequency) => {
      Object.values(state.filters).forEach((filter) => {
        filter.quality = 1.44;
      });
      const before = { ...state.filters };
      await send(ChannelEnum.ADD_FILTER, [frequency, 3]);
      const added = Object.values(state.filters).filter(
        (filter) => !before[filter.id],
      );
      expect(added).toHaveLength(1);
      expect(added[0]).toMatchObject({ frequency, quality: 1.44 });
      expect(state.eqBandQ).toBe('proportional');
    },
  );

  // Ivan, 2026-10-13: "switching built in layout needs to reset all bands and
  // their freq", "the q too needs to reset" — and never the sound: 2026-10-25,
  // "each time I change band size it resets the EQ, can't happen".
  it('starts a built-in layout on its own frequencies, its Q and both ears, playing the curve the bands played', async () => {
    Object.values(state.filters).forEach((filter, index) => {
      filter.frequency = 1590 + index * 37;
      filter.gain = 4;
      filter.quality = 1.05;
      filter.channel = 'left';
    });
    state.mainBandQ = 'proportional';
    await send(ChannelEnum.SET_FIXED_BAND, [FixedBandSizeEnum.FIFTEEN]);
    const bands = Object.values(state.filters).sort(
      (a, b) => a.frequency - b.frequency,
    );
    const frequencies = FIXED_BAND_FREQUENCIES[FixedBandSizeEnum.FIFTEEN];
    expect(bands.map((band) => band.frequency)).toEqual(frequencies);
    expect(bands.map((band) => band.quality)).toEqual(
      qualitiesForRack(frequencies),
    );
    // The bands were all lifted between 1.6 and 2.1 kHz: the layout's bands
    // there are lifted, and the far bass is left as it was, flat.
    const gainAt = (frequency: number) =>
      bands.find((band) => band.frequency === frequency)?.gain ?? Number.NaN;
    expect(gainAt(1600)).toBeGreaterThan(3);
    expect(gainAt(2500)).toBeGreaterThan(1);
    expect(Math.abs(gainAt(25))).toBeLessThan(0.5);
    expect(bands.every((band) => band.channel === undefined)).toBe(true);
    expect(state.mainBandQ).toBeUndefined();
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
      expect(update).toHaveBeenCalledTimes(1);
    },
  );

  /*
   * The EQ chip in Also applied is the EQ's only switch, and it is drawn only
   * while a band is shaped. A clear that left the EQ switched off took that
   * switch away with the gains: the bands sat greyed out and every band moved
   * afterwards was written nowhere. Released before the write, so the config
   * written has the EQ in it.
   */
  it('switches a switched-off EQ back on when it is cleared', async () => {
    Object.values(state.filters)[0].gain = 6;
    await send(ChannelEnum.CLEAR_GAINS);
    expect(release).toHaveBeenCalledTimes(1);
    expect(release).toHaveBeenCalledWith('eq');
    expect(release.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0],
    );
  });

  // The other half of the rule: preparing a tuning with the EQ switched off
  // is a reasonable thing to do, so moving a band must not switch it on.
  it('leaves a switched-off EQ off while a band is moved', async () => {
    const [filter] = Object.values(state.filters);
    await send(ChannelEnum.SET_FILTER_GAIN, [filter.id, 5]);
    expect(filter.gain).toBe(5);
    expect(release).not.toHaveBeenCalled();
  });

  // Ivan, 2026-10-13: "reset EQ resets those bands to joined".
  it('joins every left + right pair back into one band in its middle', async () => {
    const [first, second] = Object.values(state.filters);
    first.frequency = 1000;
    first.channel = 'left';
    second.frequency = 4000;
    second.type = first.type;
    second.channel = 'right';
    const count = Object.keys(state.filters).length;
    await send(ChannelEnum.CLEAR_GAINS);
    expect(Object.keys(state.filters)).toHaveLength(count - 1);
    expect(state.filters[second.id]).toBeUndefined();
    expect(state.filters[first.id]).toMatchObject({ frequency: 2000, gain: 0 });
    expect(state.filters[first.id].channel).toBeUndefined();
  });

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
