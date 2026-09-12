import fs from 'fs';
import os from 'os';
import path from 'path';
import { dialog } from 'electron';
import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import { getDefaultState, IPresetV2 } from 'common/constants';
import { registerLayersIpc } from 'main/ipc/layers';
import { registerTransferIpc, ITransferIpcDeps } from 'main/ipc/transfer';
import { savePreset } from 'main/flush';
import { flushPendingWrites } from 'main/asyncWriter';
import { serializeChainBundle } from 'common/chainBundle';
import { getEqMode, TEqMode } from 'common/eqMode';

type Handler = (event: { reply: jest.Mock }, args?: unknown) => Promise<void>;
const handlers = new Map<string, Handler>();
jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
  dialog: { showOpenDialog: jest.fn(), showSaveDialog: jest.fn() },
}));
jest.mock('main/registry', () => ({ getConfigPath: jest.fn() }));

const fire = async (channel: ChannelEnum, args?: unknown) => {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`Missing ${channel} handler`);
  }
  await handler({ reply: jest.fn() }, args);
};

describe('Main EQ x2 IPC', () => {
  it('freezes the legacy sibling choice before changing either group', async () => {
    const state = { ...getDefaultState(), eqMode: 'studio' as TEqMode };
    const error = jest.fn();
    const update = jest.fn();
    registerLayersIpc({
      state,
      handleUpdate: update,
      handleError: error,
      applyingLayer: jest.fn(),
    });
    await fire(ChannelEnum.SET_EQ_MODE, ['normal', 'eq']);
    expect(state).toMatchObject({ eqMode: 'normal', curveEqMode: 'studio' });
    await fire(ChannelEnum.SET_EQ_MODE, ['double', 'curves']);
    expect(state).toMatchObject({ eqMode: 'normal', curveEqMode: 'double' });
    const before = JSON.stringify(state);
    await fire(ChannelEnum.SET_EQ_MODE, ['double', 'dsp']);
    expect(JSON.stringify(state)).toBe(before);
    expect(error).toHaveBeenCalledTimes(1);
  });
  it.each<TEqMode>(['normal', 'double', 'studio'])(
    'sets %s exclusively through the standard update path',
    async (eqMode) => {
      const state = {
        ...getDefaultState(),
        eqMode: 'studio' as TEqMode,
        isEqDoubleOn: true,
      };
      const { filters } = state;
      const update = jest.fn().mockResolvedValue(undefined);
      const error = jest.fn();
      registerLayersIpc({
        state,
        handleUpdate: update,
        handleError: error,
        applyingLayer: jest.fn(),
      });
      expect(ChannelEnum.SET_EQ_MODE).toBe('setEqMode');
      await fire(ChannelEnum.SET_EQ_MODE, [eqMode]);
      expect(getEqMode(state)).toBe(eqMode);
      expect(state.isEqDoubleOn).toBe(eqMode === 'double');
      expect(state.filters).toBe(filters);
      expect(error).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(
        expect.anything(),
        ChannelEnum.SET_EQ_MODE,
        false,
        true,
      );
    },
  );

  it.each([undefined, null, [], [true], ['invalid'], [1]])(
    'refuses invalid EQ mode payload %p',
    async (args) => {
      const state = { ...getDefaultState(), eqMode: 'studio' as TEqMode };
      const original = JSON.stringify(state);
      const error = jest.fn();
      const update = jest.fn();
      registerLayersIpc({
        state,
        handleUpdate: update,
        handleError: error,
        applyingLayer: jest.fn(),
      });
      await fire(ChannelEnum.SET_EQ_MODE, args);
      expect(JSON.stringify(state)).toBe(original);
      expect(update).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        expect.anything(),
        ChannelEnum.SET_EQ_MODE,
        ErrorCode.INVALID_PARAMETER,
      );
    },
  );

  it('uses the standard update path for each boolean without touching bands, bypass or other layers', async () => {
    const state = getDefaultState();
    state.bypassed = ['eq'];
    state.voicing = { profileId: 'music', intensity: 0.5 };
    const original = JSON.parse(JSON.stringify(state));
    const update = jest.fn().mockResolvedValue(undefined);
    const error = jest.fn();
    registerLayersIpc({
      state,
      handleUpdate: update,
      handleError: error,
      applyingLayer: jest.fn(),
    });
    expect(ChannelEnum.SET_EQ_DOUBLE).toBe('setEqDouble');
    await fire(ChannelEnum.SET_EQ_DOUBLE, [true]);
    expect(state).toEqual({
      ...original,
      isEqDoubleOn: true,
      eqMode: 'double',
      curveEqMode: 'normal',
      eqBandQ: 'off',
      curveBandQ: 'off',
    });
    await fire(ChannelEnum.SET_EQ_DOUBLE, [false]);
    expect(state).toEqual({
      ...original,
      isEqDoubleOn: false,
      eqMode: 'normal',
      curveEqMode: 'normal',
      eqBandQ: 'off',
      curveBandQ: 'off',
    });
    expect(error).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenLastCalledWith(
      expect.anything(),
      ChannelEnum.SET_EQ_DOUBLE,
      false,
      true,
    );
  });

  it.each([undefined, null, [], ['true'], [1], [{}]])(
    'rejects invalid payload %p without mutating state or writing files',
    async (args) => {
      const state = { ...getDefaultState(), isEqDoubleOn: true };
      const original = JSON.parse(JSON.stringify(state));
      const update = jest.fn();
      const error = jest.fn();
      registerLayersIpc({
        state,
        handleUpdate: update,
        handleError: error,
        applyingLayer: jest.fn(),
      });
      await fire(ChannelEnum.SET_EQ_DOUBLE, args);
      expect(state).toEqual(original);
      expect(update).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        expect.anything(),
        ChannelEnum.SET_EQ_DOUBLE,
        ErrorCode.INVALID_PARAMETER,
      );
    },
  );
});

describe('Main EQ x2 import and export IPC', () => {
  let directory: string;
  let deps: ITransferIpcDeps;
  beforeEach(() => {
    directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'fluideq-eq-double-ipc-'),
    );
    deps = {
      state: getDefaultState(),
      deviceProfileSettings: {
        version: 1,
        assignments: {
          output: {
            deviceId: 'output',
            deviceName: 'Output',
            deviceGuid: '{OUTPUT}',
            presetName: 'Profile',
          },
        },
      },
      session: {
        configPath: directory,
        activeAudioDeviceId: 'output',
        activeAudioDevice: undefined,
        hasActiveSessionOverride: false,
        audioEngine: null,
      },
      activeBaselineDir: () => path.join(directory, 'baselines'),
      getMainWindow: () => null,
      presetDirForDevice: () => directory,
      activePresetDir: () => directory,
      availableProfileNameForActiveDevice: (name) => name,
      attachPresetToActiveDevice: jest.fn(),
      clearCurrentLayoutSettings: jest.fn(),
      resetEqToDefaults: jest.fn(),
      hydrateActiveConvolution: jest.fn(),
      shieldReferenceBands: (filters) => filters,
      applyingLayer: jest.fn(),
      handleError: jest.fn(),
      handleUpdateHelper: jest.fn().mockResolvedValue(undefined),
    };
    registerTransferIpc(deps);
  });
  afterEach(async () => {
    await flushPendingWrites();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it.each<TEqMode>(['normal', 'double', 'studio'])(
    'keeps explicit %s through file import and chain export/import',
    async (eqMode) => {
      const preset: IPresetV2 = {
        preAmp: 0,
        filters: getDefaultState().filters,
        eqMode,
        isEqDoubleOn: eqMode !== 'double',
      };
      await savePreset('Profile', preset, directory);
      jest.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: [path.join(directory, 'Profile')],
      });
      await fire(ChannelEnum.IMPORT_EQ_FILE);
      expect(getEqMode(deps.state)).toBe(eqMode);
      const filePath = path.join(directory, 'mode.fluideq');
      jest
        .mocked(dialog.showSaveDialog)
        .mockResolvedValue({ canceled: false, filePath });
      await fire(ChannelEnum.EXPORT_DEVICE_CHAIN, ['{OUTPUT}']);
      expect(JSON.parse(fs.readFileSync(filePath, 'utf8')).preset.eqMode).toBe(
        eqMode,
      );
      deps.state.eqMode = eqMode === 'studio' ? 'normal' : 'studio';
      jest
        .mocked(dialog.showOpenDialog)
        .mockResolvedValue({ canceled: false, filePaths: [filePath] });
      await fire(ChannelEnum.IMPORT_DEVICE_CHAIN);
      expect(deps.handleError).not.toHaveBeenCalled();
      expect(getEqMode(deps.state)).toBe(eqMode);
      expect(deps.state.isEqDoubleOn).toBe(eqMode === 'double');
    },
  );

  it.each([true, false, undefined])(
    'loads %s from a profile file instead of retaining the previous switch',
    async (isEqDoubleOn) => {
      const preset: IPresetV2 = {
        preAmp: 0,
        filters: getDefaultState().filters,
        isEqDoubleOn,
      };
      await savePreset('Profile', preset, directory);
      deps.state.isEqDoubleOn = isEqDoubleOn !== true;
      jest.mocked(dialog.showOpenDialog).mockResolvedValue({
        canceled: false,
        filePaths: [path.join(directory, 'Profile')],
      });
      await fire(ChannelEnum.IMPORT_EQ_FILE);
      expect(deps.handleError).not.toHaveBeenCalled();
      expect(deps.state.isEqDoubleOn).toBe(isEqDoubleOn ?? false);
      expect(deps.state.filters).toEqual(preset.filters);
    },
  );

  it.each([true, false, undefined])(
    'exports and imports a device chain with %s',
    async (isEqDoubleOn) => {
      const preset: IPresetV2 = {
        preAmp: 0,
        filters: getDefaultState().filters,
        isEqDoubleOn,
      };
      await savePreset('Profile', preset, directory);
      const filePath = path.join(directory, 'chain.fluideq');
      jest
        .mocked(dialog.showSaveDialog)
        .mockResolvedValue({ canceled: false, filePath });
      await fire(ChannelEnum.EXPORT_DEVICE_CHAIN, ['{OUTPUT}']);
      expect(deps.handleError).not.toHaveBeenCalled();
      expect(
        JSON.parse(fs.readFileSync(filePath, 'utf8')).preset.isEqDoubleOn,
      ).toBe(isEqDoubleOn);
      deps.state.isEqDoubleOn = isEqDoubleOn !== true;
      jest
        .mocked(dialog.showOpenDialog)
        .mockResolvedValue({ canceled: false, filePaths: [filePath] });
      await fire(ChannelEnum.IMPORT_DEVICE_CHAIN);
      expect(deps.handleError).not.toHaveBeenCalled();
      expect(deps.state.isEqDoubleOn).toBe(isEqDoubleOn ?? false);
      expect(deps.state.filters).toEqual(preset.filters);
    },
  );

  it('rejects an invalid imported flag instead of replacing the live state', async () => {
    const filePath = path.join(directory, 'invalid.fluideq');
    const bundle = JSON.parse(
      serializeChainBundle({ version: 1, preset: { preAmp: 0, filters: {} } }),
    );
    bundle.preset.isEqDoubleOn = 'true';
    fs.writeFileSync(filePath, JSON.stringify(bundle));
    const original = JSON.parse(JSON.stringify(deps.state));
    jest
      .mocked(dialog.showOpenDialog)
      .mockResolvedValue({ canceled: false, filePaths: [filePath] });
    await fire(ChannelEnum.IMPORT_DEVICE_CHAIN);
    expect(deps.handleError).toHaveBeenCalledWith(
      expect.anything(),
      ChannelEnum.IMPORT_DEVICE_CHAIN,
      ErrorCode.IMPORT_ERROR,
      expect.any(String),
    );
    expect(deps.state).toEqual(original);
  });

  it('imports plain EQ text as one pass but does not change x2 when importing another layer', async () => {
    const text = 'Filter 1: ON PK Fc 1000 Hz Gain 3 dB Q 1';
    deps.state.isEqDoubleOn = true;
    await fire(ChannelEnum.IMPORT_EQ_TEXT, [text, 'Correction', 'curve']);
    expect(deps.state.isEqDoubleOn).toBe(true);
    expect(deps.state.headphone).toBeDefined();
    await fire(ChannelEnum.IMPORT_EQ_TEXT, [text, 'Main', 'eq']);
    expect(deps.handleError).not.toHaveBeenCalled();
    expect(deps.state.isEqDoubleOn).toBe(false);
    expect(Object.values(deps.state.filters)).toHaveLength(1);
  });
});
it('validates and persists shape choices without crossing groups or changing strength', async () => {
  const state = { ...getDefaultState(), eqMode: 'studio' as TEqMode };
  const update = jest.fn();
  const error = jest.fn();
  registerLayersIpc({
    state,
    handleUpdate: update,
    handleError: error,
    applyingLayer: jest.fn(),
  });
  await fire(ChannelEnum.SET_EQ_SHAPE, ['eq', 'q', 'asymmetric']);
  await fire(ChannelEnum.SET_EQ_SHAPE, ['curves', 'q', 'off']);
  await fire(ChannelEnum.SET_EQ_SHAPE, ['curves', 'smoothing', 'third']);
  expect(state).toMatchObject({
    eqMode: 'studio',
    eqBandQ: 'asymmetric',
    curveBandQ: 'off',
    curveSmoothing: 'third',
  });
  expect(update).toHaveBeenCalledTimes(3);
  const snapshot = JSON.stringify(state);
  await [
    undefined,
    {},
    ['eq', 'smoothing', 'third'],
    ['dsp', 'q', 'off'],
    ['curves', 'q', 'third'],
    ['eq', 'q', 'fixed'],
    ['curves', 'q', 'fixed'],
    ['curves', 'smoothing', 'asymmetric'],
  ].reduce(async (previous, payload) => {
    await previous;
    await fire(ChannelEnum.SET_EQ_SHAPE, payload);
    expect(JSON.stringify(state)).toBe(snapshot);
  }, Promise.resolve());
  expect(error).toHaveBeenCalledTimes(8);
  expect(update).toHaveBeenCalledTimes(3);
});
