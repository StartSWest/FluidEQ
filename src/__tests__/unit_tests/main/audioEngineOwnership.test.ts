/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */
import ChannelEnum from '../../../common/channels';
import { clampDspSettings } from '../../../common/dsp/chain';
import { encodeChainSettings } from '../../../common/dsp/chainWire';
import type { IOutputDspEdit } from '../../../common/outputSettings';
import { registerAudioEngineIpc } from '../../../main/ipc/audioEngine';
import { createAutomaticSetup } from '../../../main/automaticSetup';

type Handler = (
  event: { reply: jest.Mock },
  args: unknown,
) => void | Promise<void>;
const handlers = new Map<string, Handler>();
jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, handler: Handler) => handlers.set(channel, handler),
  },
}));
const deferred = () => {
  let complete: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    complete = resolve;
  });
  return { promise, resolve: complete };
};
const settings = clampDspSettings({ enabled: true });
const edit: IOutputDspEdit = { deviceId: 'main', generation: 2, settings };
const setup = () => {
  let saved: IOutputDspEdit | undefined;
  const entered = deferred();
  const release = deferred();
  const save = jest.fn(async (next: IOutputDspEdit) => {
    saved = next;
  });
  save.mockImplementationOnce(async (next) => {
    saved = next;
    entered.resolve();
    await release.promise;
  });
  const written = deferred();
  const write = jest.fn(async (_config: string, _edit: IOutputDspEdit) => {
    written.resolve();
  });
  registerAudioEngineIpc({
    userDataDir: 'C:/test-data',
    getEngine: () => 'fluid',
    setEngine: () => undefined,
    setSwitching: () => undefined,
    isSwitching: () => false,
    getConfigPath: async () => 'C:/test-config',
    isEngineInstalled: async () => true,
    reflush: async () => ({ ok: true }),
    runEngineSetup: async () => ({ ok: true, declined: false, endpoints: [] }),
    readAudioEngineStatus: async () => ({
      engine: 'fluid',
      apo: { installed: false },
      fluid: { installed: true, endpoints: [], dllVersion: '1.19.0.0' },
      fluidSupported: true,
      fluidUpdateReady: false,
    }),
    neutraliseEngine: async () => 'written',
    isApoOnAnyOutput: async () => false,
    isApoSwitchedOff: async () => false,
    repairEngineLoading: async () => undefined,
    repairEngineOutput: async () => ({ ok: true, declined: false }),
    automatic: createAutomaticSetup(),
    writeSystemDspChain: async () => undefined,
    getDspTarget: () => ({
      device: {
        id: 'main',
        name: 'Main',
        guid: '{01234567-89ab-cdef-0123-456789abcdef}',
        isActive: true,
        isDefault: true,
      },
      generation: 2,
    }),
    saveOutputDsp: save,
    isOutputDspCurrent: (candidate) => candidate === saved,
    writeOutputDsp: write,
  });
  const send = async (candidate: unknown) => {
    const handler = handlers.get(ChannelEnum.SET_SYSTEM_DSP_CHAIN);
    if (!handler) {
      throw new Error('Missing DSP handler');
    }
    const reply = jest.fn();
    await handler({ reply }, [encodeChainSettings(settings), candidate]);
    return reply;
  };
  return {
    send,
    entered: entered.promise,
    release: release.resolve,
    written: written.promise,
    write,
    save,
  };
};

it.each([
  ['secondary', { ...edit, deviceId: 'secondary', generation: 1 }],
  ['old generation', { ...edit, generation: 1 }],
  ['missing settings', { deviceId: 'main', generation: 2 }],
])(
  'a rejected %s edit cannot cancel a valid pending main write',
  async (_label, rejected) => {
    const t = setup();
    const current = t.send(edit);
    await t.entered;
    const invalid = await t.send(rejected);
    expect(invalid).toHaveBeenCalledWith(ChannelEnum.SET_SYSTEM_DSP_CHAIN, {
      result: 'rejected',
    });
    t.release();
    expect(await current).toHaveBeenCalledWith(
      ChannelEnum.SET_SYSTEM_DSP_CHAIN,
      { result: 'written' },
    );
    expect(t.write).toHaveBeenCalledWith(
      'C:/test-config',
      expect.objectContaining(edit),
    );
    expect(t.save).toHaveBeenCalledTimes(1);
  },
);

it('a newer accepted main edit still supersedes the pending older rack', async () => {
  const t = setup();
  const first = t.send(edit);
  await t.entered;
  const newer = { ...edit, settings: clampDspSettings({ enabled: false }) };
  expect(await t.send(newer)).toHaveBeenCalledWith(
    ChannelEnum.SET_SYSTEM_DSP_CHAIN,
    { result: 'written' },
  );
  t.release();
  expect(await first).toHaveBeenCalledWith(ChannelEnum.SET_SYSTEM_DSP_CHAIN, {
    result: 'not-fluid',
  });
  expect(t.write).toHaveBeenCalledTimes(1);
  expect(t.write).toHaveBeenCalledWith(
    'C:/test-config',
    expect.objectContaining(newer),
  );
});

/**
 * A rack edit used to wait for the profile's disk write before the engine
 * heard it, so every knob was heard that much late. The engine is written
 * while the save is still held here; the answer waits for the save.
 */
it('lets the engine hear an edit before its profile save is done', async () => {
  const t = setup();
  const reply = t.send(edit);
  await t.entered;
  // Resolves only if the write lands while the save is still held.
  await t.written;
  expect(t.write).toHaveBeenCalledWith(
    'C:/test-config',
    expect.objectContaining(edit),
  );
  t.release();
  expect(await reply).toHaveBeenCalledWith(ChannelEnum.SET_SYSTEM_DSP_CHAIN, {
    result: 'written',
  });
});

it('still reports a profile save that failed', async () => {
  const t = setup();
  t.save.mockReset();
  t.save.mockRejectedValue(new Error('disk full'));
  const reply = await t.send(edit);
  expect(reply).toHaveBeenCalledWith(
    ChannelEnum.SET_SYSTEM_DSP_CHAIN,
    expect.objectContaining({ errorCode: expect.anything() }),
  );
});
