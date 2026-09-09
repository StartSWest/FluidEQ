/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine channels, fired for real.
 *
 * What is worth testing here is ORDER and REFUSAL, neither of which any
 * helper underneath can see. The old engine has to be neutralised before the
 * new one is written, or for the length of one flush both of them hold a
 * chain and every output is processed twice; and a helper that self-elevates
 * must never be reachable with an argument the renderer made up, which is
 * why a malformed GUID has to be refused before `execFile` is ever asked to
 * spawn anything.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  AUDIO_ENGINE_FILENAME,
  IAudioEngineStatus,
  TAudioEngine,
} from '../../../common/audioEngine';
import { ErrorCode } from '../../../common/errors';
import ChannelEnum from '../../../common/channels';
import type { IEngineSetupResult } from '../../../main/engineSetup';
import { encodeChainSettings } from '../../../common/dsp/chainWire';
import { DSP_DEFAULTS } from '../../../common/dsp/chain';

type THandler = (
  event: { reply: jest.Mock },
  arg: unknown,
) => void | Promise<void>;

const handlers = new Map<string, THandler>();

jest.mock('electron', () => ({
  ipcMain: {
    handle: jest.fn(),
    on: (channel: string, handler: THandler) => {
      handlers.set(channel, handler);
    },
  },
}));

// eslint-disable-next-line import/first
import { registerAudioEngineIpc } from '../../../main/ipc/audioEngine';
// eslint-disable-next-line import/first
import { loadAudioEnginePreference } from '../../../main/audioEngineStore';

const STATUS: IAudioEngineStatus = {
  engine: 'apo',
  apo: { installed: true },
  fluid: { installed: false, endpoints: [] },
  fluidSupported: true,
};

const OK: IEngineSetupResult = {
  ok: true,
  declined: false,
  endpoints: [
    { guid: '{0.0.0.00000000}', attached: true, backupExists: false },
  ],
};

const DECLINED: IEngineSetupResult = {
  ok: false,
  declined: true,
  endpoints: [],
};

const GUID = '{a1b2c3d4-e5f6-4708-9a0b-1c2d3e4f5061}';

describe('the audio engine channels', () => {
  let userDataDir: string;
  let engine: TAudioEngine | null;
  let order: string[];
  let neutraliseEngine: jest.Mock;
  let reflush: jest.Mock;
  let setEngine: jest.Mock;
  let runEngineSetup: jest.Mock;
  let writeSystemDspChain: jest.Mock;
  let getConfigPath: jest.Mock;

  const fire = async (channel: ChannelEnum, arg: unknown) => {
    const reply = jest.fn();
    await handlers.get(channel)?.({ reply }, arg);
    return reply;
  };

  const replied = (reply: jest.Mock): unknown => reply.mock.calls[0]?.[1];

  beforeEach(() => {
    handlers.clear();
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-engine-ipc-'));
    engine = 'apo';
    order = [];
    neutraliseEngine = jest.fn(async (other: TAudioEngine) => {
      order.push(`neutralise:${other}`);
      return 'written' as const;
    });
    reflush = jest.fn(async () => {
      order.push('reflush');
    });
    setEngine = jest.fn((next: TAudioEngine) => {
      order.push(`set:${next}`);
      engine = next;
    });
    runEngineSetup = jest.fn(async () => OK);
    writeSystemDspChain = jest.fn(async () => undefined);
    getConfigPath = jest.fn(async () => path.join(userDataDir, 'config'));

    registerAudioEngineIpc({
      userDataDir,
      getEngine: () => engine,
      setEngine,
      getConfigPath,
      reflush,
      runEngineSetup,
      readAudioEngineStatus: async () => STATUS,
      neutraliseEngine,
      writeSystemDspChain,
    });
  });

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  });

  it('reports the status', async () => {
    const reply = await fire(ChannelEnum.GET_AUDIO_ENGINE_STATUS, []);
    expect(replied(reply)).toEqual({ result: STATUS });
  });

  it('neutralises Equalizer APO before the engine is written', async () => {
    const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

    expect(order).toEqual(['neutralise:apo', 'set:fluid', 'reflush']);
    expect(loadAudioEnginePreference(userDataDir).engine).toBe('fluid');
    expect(replied(reply)).toEqual({ result: undefined });
  });

  it('neutralises the engine before Equalizer APO is written', async () => {
    engine = 'fluid';
    await fire(ChannelEnum.SET_AUDIO_ENGINE, ['apo']);

    expect(order).toEqual(['neutralise:fluid', 'set:apo', 'reflush']);
    expect(loadAudioEnginePreference(userDataDir).engine).toBe('apo');
  });

  it('does nothing at all when the engine is already the one asked for', async () => {
    engine = 'fluid';
    const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

    expect(order).toEqual([]);
    expect(neutraliseEngine).not.toHaveBeenCalled();
    expect(reflush).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(userDataDir, AUDIO_ENGINE_FILENAME))).toBe(
      false,
    );
    expect(replied(reply)).toEqual({ result: undefined });
  });

  it('refuses an engine name it does not know', async () => {
    const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['bogus']);

    expect(replied(reply)).toEqual({
      errorCode: ErrorCode.INVALID_PARAMETER,
    });
    expect(order).toEqual([]);
    expect(fs.existsSync(path.join(userDataDir, AUDIO_ENGINE_FILENAME))).toBe(
      false,
    );
  });

  it('reflushes after the engine installs', async () => {
    const reply = await fire(ChannelEnum.INSTALL_FLUID_ENGINE, []);

    expect(runEngineSetup).toHaveBeenCalledWith('install', [
      '--attach-all',
      '--restart-audio',
    ]);
    expect(reflush).toHaveBeenCalledTimes(1);
    expect(replied(reply)).toEqual({ result: OK });
  });

  it('does not reflush when the elevation prompt was declined', async () => {
    runEngineSetup.mockResolvedValue(DECLINED);
    const reply = await fire(ChannelEnum.INSTALL_FLUID_ENGINE, []);

    expect(reflush).not.toHaveBeenCalled();
    expect(replied(reply)).toEqual({ result: DECLINED });
  });

  it('attaches and detaches one endpoint', async () => {
    await fire(ChannelEnum.ATTACH_FLUID_ENGINE, [GUID]);
    expect(runEngineSetup).toHaveBeenCalledWith('attach', [
      GUID,
      '--restart-audio',
    ]);

    await fire(ChannelEnum.DETACH_FLUID_ENGINE, [GUID]);
    expect(runEngineSetup).toHaveBeenCalledWith('detach', [
      GUID,
      '--restart-audio',
    ]);
    expect(reflush).toHaveBeenCalledTimes(2);
  });

  it('never hands the setup helper a GUID it cannot recognise', async () => {
    const reply = await fire(ChannelEnum.ATTACH_FLUID_ENGINE, ['{not-a-guid}']);

    expect(runEngineSetup).not.toHaveBeenCalled();
    expect(replied(reply)).toEqual({
      errorCode: ErrorCode.INVALID_PARAMETER,
    });
  });

  it('refuses a rack snapshot of the wrong length', async () => {
    engine = 'fluid';
    const reply = await fire(ChannelEnum.SET_SYSTEM_DSP_CHAIN, [[1, 2, 3]]);

    expect(writeSystemDspChain).not.toHaveBeenCalled();
    expect(replied(reply)).toEqual({ result: false });
  });

  it('writes the rack under the FluidEQ Engine', async () => {
    engine = 'fluid';
    const values = encodeChainSettings(DSP_DEFAULTS);
    const reply = await fire(ChannelEnum.SET_SYSTEM_DSP_CHAIN, [values]);

    expect(getConfigPath).toHaveBeenCalledWith('fluid');
    expect(writeSystemDspChain).toHaveBeenCalledWith(
      path.join(userDataDir, 'config'),
      values,
    );
    expect(replied(reply)).toEqual({ result: true });
  });

  it('writes no rack under Equalizer APO', async () => {
    const reply = await fire(ChannelEnum.SET_SYSTEM_DSP_CHAIN, [
      encodeChainSettings(DSP_DEFAULTS),
    ]);

    expect(writeSystemDspChain).not.toHaveBeenCalled();
    expect(replied(reply)).toEqual({ result: false });
  });
});
