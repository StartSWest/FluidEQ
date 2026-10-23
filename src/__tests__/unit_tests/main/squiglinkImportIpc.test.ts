import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import { FilterTypeEnum, getDefaultState } from 'common/constants';
import { registerTransferIpc, ITransferIpcDeps } from 'main/ipc/transfer';

type Handler = (event: { reply: jest.Mock }, args: unknown) => Promise<void>;
const handlers = new Map<string, Handler>();
jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
}));
jest.mock('main/registry', () => ({ getConfigPath: jest.fn() }));
jest.mock('main/flush', () => ({
  fetchPreset: jest.fn(),
  savePreset: jest.fn(),
  savePresetBaseline: jest.fn(),
}));
jest.mock('main/importSettings', () => ({
  importConvolutionFile: jest.fn(),
  importEqFile: jest.fn(),
}));

const text = 'Preamp: -6 dB\nFilter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1';
const setup = () => {
  const state = getDefaultState();
  state.filters = {
    original: {
      id: 'original',
      type: FilterTypeEnum.PK,
      frequency: 300,
      gain: -2,
      quality: 1,
    },
  };
  const deps: ITransferIpcDeps = {
    userDataDir: 'unused',
    state,
    deviceProfileSettings: { version: 1, assignments: {} },
    session: {
      configPath: '',
      activeAudioDeviceId: 'output',
      activeAudioDevice: undefined,
      hasActiveSessionOverride: false,
      audioEngine: null,
    },
    activeBaselineDir: () => '',
    getMainWindow: () => null,
    presetDirForDevice: () => '',
    activePresetDir: () => '',
    availableProfileNameForActiveDevice: (name) => name,
    attachPresetToActiveDevice: jest.fn(),
    resetEqToDefaults: jest.fn(() => {
      state.eqImport = undefined;
      state.filters = {};
      state.preAmp = 0;
    }),
    hydrateActiveConvolution: jest.fn(),
    shieldReferenceBands: (filters) => filters,
    applyingLayer: jest.fn(),
    handleError: jest.fn(),
    handleUpdateHelper: jest.fn().mockResolvedValue(undefined),
  };
  registerTransferIpc(deps);
  const handler = handlers.get(ChannelEnum.IMPORT_EQ_TEXT);
  if (!handler) {
    throw new Error('Import handler was not registered');
  }
  const event = { reply: jest.fn() };
  return {
    state,
    deps,
    event,
    importText: (destination: string) =>
      handler(event, [text, 'My correction', destination]),
  };
};

it('applies a separate correction without replacing independently edited bands', async () => {
  const { state, deps, importText } = setup();
  const bands = state.filters;
  await importText('curve');
  expect(deps.handleError).not.toHaveBeenCalled();
  expect(state.filters).toBe(bands);
  expect(deps.resetEqToDefaults).not.toHaveBeenCalled();
  expect(state.headphone?.eqImport?.text).toBe(text);
  expect(Object.values(state.headphone?.filters ?? {})[0].gain).toBe(4);
  expect(state.preAmp).toBe(-6);
  expect(state.isAutoPreAmpOn).toBe(false);
  expect(deps.applyingLayer).toHaveBeenCalledWith('headphone');
});

it('switches an imported EQ into a correction without applying the import twice', async () => {
  const { state, deps, importText } = setup();
  await importText('eq');
  expect(state.eqImport?.text).toBe(text);
  await importText('curve');
  expect(deps.resetEqToDefaults).toHaveBeenCalledTimes(1);
  expect(state.eqImport).toBeUndefined();
  expect(Object.keys(state.filters)).toHaveLength(0);
  expect(state.headphone?.eqImport?.text).toBe(text);
});

it('switches an imported correction into bands without retaining a duplicate correction', async () => {
  const { state, deps, importText } = setup();
  await importText('curve');
  await importText('eq');
  expect(deps.handleError).not.toHaveBeenCalled();
  expect(state.headphone).toBeUndefined();
  expect(state.eqImport?.text).toBe(text);
  expect(Object.values(state.filters)[0].gain).toBe(4);
  expect(deps.applyingLayer).toHaveBeenCalledWith('eq');
});

it('keeps an unrelated OPRA correction when replacing editable bands', async () => {
  const { state, importText } = setup();
  const headphone = { filters: state.filters, intensity: 0.5 };
  state.headphone = headphone;
  state.headset = 'My headphones';
  await importText('eq');
  expect(state.headphone).toBe(headphone);
  expect(state.headset).toBe('My headphones');
  expect(state.eqImport?.text).toBe(text);
});

it('rejects an unknown destination before changing the current tuning', async () => {
  const { state, deps, event, importText } = setup();
  const before = JSON.stringify(state);
  await importText('invalid');
  expect(deps.handleError).toHaveBeenCalledWith(
    event,
    ChannelEnum.IMPORT_EQ_TEXT,
    ErrorCode.INVALID_PARAMETER,
  );
  expect(JSON.stringify(state)).toBe(before);
  expect(deps.handleUpdateHelper).not.toHaveBeenCalled();
});

// Ivan, 2026-10-13: "to be able to fill either or both left and right".
describe('Apply as EQ into one ear', () => {
  const into = (ears: string) => {
    const made = setup();
    const handler = handlers.get(ChannelEnum.IMPORT_EQ_TEXT);
    if (!handler) {
      throw new Error('Import handler was not registered');
    }
    return {
      ...made,
      run: () => handler(made.event, [text, 'Left', 'eq', ears]),
    };
  };

  it('puts the curve on that ear and keeps the other ear what it had', async () => {
    const { state, deps, run } = into('left');
    await run();
    expect(deps.handleError).not.toHaveBeenCalled();
    const bands = Object.values(state.filters);
    // The band that was on both ears stays, on the right only.
    expect(state.filters.original).toMatchObject({
      channel: 'right',
      gain: -2,
    });
    expect(bands.filter((one) => one.channel === 'left')).toEqual([
      expect.objectContaining({ frequency: 1000, gain: 4 }),
    ]);
    // One ear's file leaves the level alone.
    expect(state.preAmp).not.toBe(-6);
  });

  it('replaces only that ear on a second import', async () => {
    const { state, run } = into('left');
    await run();
    await run();
    expect(
      Object.values(state.filters).filter((one) => one.channel === 'left'),
    ).toHaveLength(1);
    expect(state.filters.original.channel).toBe('right');
  });

  it('refuses an ear it does not know before touching the tuning', async () => {
    const { state, deps, run } = into('middle');
    const before = JSON.stringify(state.filters);
    await run();
    expect(deps.handleError).toHaveBeenCalled();
    expect(JSON.stringify(state.filters)).toBe(before);
  });
});
