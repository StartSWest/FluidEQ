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

// Imports come after jest.mock on purpose: the module under test reads the
// mocked dependency at import time, so hoisting the import above the mock
// would bind it to the real one and the test would exercise nothing.
// eslint-disable-next-line import/first
import { registerAudioEngineIpc } from '../../../main/ipc/audioEngine';
// eslint-disable-next-line import/first
import { loadAudioEnginePreference } from '../../../main/audioEngineStore';

const STATUS: IAudioEngineStatus = {
  engine: 'apo',
  apo: { installed: true },
  fluid: { installed: false, endpoints: [] },
  fluidSupported: true,
  fluidUpdateReady: false,
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
  let switching: boolean;
  let switchingDuring: Map<string, boolean>;
  let neutraliseEngine: jest.Mock;
  let reflush: jest.Mock;
  let setEngine: jest.Mock;
  let setSwitching: jest.Mock;
  let isSwitching: jest.Mock;
  let isEngineInstalled: jest.Mock;
  let runEngineSetup: jest.Mock;
  let readAudioEngineStatus: jest.Mock;
  let writeSystemDspChain: jest.Mock;
  // Equalizer APO nowhere by default, so the plain switch cases stay about
  // switching. The cases that are about Equalizer APO set these themselves.
  let isApoOnAnyOutput: jest.Mock;
  let isApoSwitchedOff: jest.Mock;
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
    switching = false;
    // What the mid-switch flag read at each step, so the ordering can be
    // asserted rather than assumed: it has to be up for the neutralise and the
    // engine swap, and down again before the reflush.
    switchingDuring = new Map<string, boolean>();
    const record = (step: string) => {
      order.push(step);
      switchingDuring.set(step, switching);
    };
    neutraliseEngine = jest.fn(async (other: TAudioEngine) => {
      record(`neutralise:${other}`);
      return 'written' as const;
    });
    reflush = jest.fn(async () => {
      record('reflush');
      return { ok: true } as const;
    });
    setEngine = jest.fn((next: TAudioEngine) => {
      record(`set:${next}`);
      engine = next;
    });
    setSwitching = jest.fn((nextSwitching: boolean) => {
      switching = nextSwitching;
    });
    isSwitching = jest.fn(() => switching);
    isEngineInstalled = jest.fn(async () => true);
    runEngineSetup = jest.fn(async () => OK);
    readAudioEngineStatus = jest.fn(async () => {
      record('status');
      return STATUS;
    });
    writeSystemDspChain = jest.fn(async () => undefined);
    getConfigPath = jest.fn(async () => path.join(userDataDir, 'config'));
    isApoOnAnyOutput = jest.fn(async () => false);
    isApoSwitchedOff = jest.fn(async () => false);

    registerAudioEngineIpc({
      userDataDir,
      getEngine: () => engine,
      setEngine,
      setSwitching,
      isSwitching,
      getConfigPath,
      isEngineInstalled,
      reflush,
      runEngineSetup,
      readAudioEngineStatus,
      neutraliseEngine,
      writeSystemDspChain,
      isApoOnAnyOutput,
      isApoSwitchedOff,
      repairEngineLoading: async () => undefined,
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

  // The window is between the neutralise and the reflush: for that stretch the
  // session still names the directory that has just been emptied, and a flush
  // into it would put the old engine's chain back underneath the new one's.
  it('holds the switching flag up until the moment it reflushes', async () => {
    await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

    expect(switchingDuring.get('neutralise:apo')).toBe(true);
    expect(switchingDuring.get('set:fluid')).toBe(true);
    expect(switchingDuring.get('reflush')).toBe(false);
    expect(switching).toBe(false);
  });

  // Otherwise every EQ edit for the rest of the session is silently dropped by
  // an update path that still believes a switch is running.
  it('lowers the switching flag even when neutralising throws', async () => {
    neutraliseEngine.mockRejectedValue(new Error('locked'));
    const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

    expect(switching).toBe(false);
    expect(replied(reply)).toEqual({ errorCode: ErrorCode.FAILURE });
  });

  // "The engine switched fine, nothing is being processed" is the failure a
  // success reply here produces, and the banner never appears to explain it.
  it('replies the reflush failure rather than a success', async () => {
    const error = { errorCode: ErrorCode.FLUID_ENGINE_NOT_INSTALLED };
    reflush.mockResolvedValue({ ok: false, error });

    const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

    // The choice is still kept: the user asked for this engine, and the
    // banner is what tells them what is missing.
    expect(loadAudioEnginePreference(userDataDir).engine).toBe('fluid');
    expect(replied(reply)).toEqual(error);
  });

  describe('a switch that fails', () => {
    const notInstalled = { errorCode: ErrorCode.FLUID_ENGINE_NOT_INSTALLED };

    // Windows audio still restarting after the install is the usual reason,
    // and the same switch a moment later works.
    it('waits for Windows and tries again, replying only how it ended', async () => {
      reflush
        .mockImplementationOnce(async () => {
          order.push('reflush');
          return { ok: false, error: notInstalled };
        })
        .mockImplementationOnce(async () => {
          order.push('reflush');
          return { ok: true };
        });

      const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      expect(order).toEqual([
        'neutralise:apo',
        'set:fluid',
        'reflush',
        'status',
        'neutralise:apo',
        'set:fluid',
        'reflush',
      ]);
      expect(runEngineSetup).toHaveBeenCalledWith('settle', []);
      expect(reply).toHaveBeenCalledTimes(1);
      expect(replied(reply)).toEqual({ result: undefined });
    });

    it('replies the failure after the third try, and not before', async () => {
      reflush.mockResolvedValue({ ok: false, error: notInstalled });

      const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      expect(reflush).toHaveBeenCalledTimes(3);
      expect(
        runEngineSetup.mock.calls.filter(([command]) => command === 'settle'),
      ).toHaveLength(2);
      expect(reply).toHaveBeenCalledTimes(1);
      expect(replied(reply)).toEqual(notInstalled);
      expect(switching).toBe(false);
    });

    it('stops trying once Windows has settled and the engine is still missing', async () => {
      reflush.mockResolvedValue({ ok: false, error: notInstalled });
      isEngineInstalled.mockResolvedValue(false);

      const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      expect(reflush).toHaveBeenCalledTimes(1);
      expect(replied(reply)).toEqual(notInstalled);
    });

    it('stops trying when Windows audio could not be waited for', async () => {
      reflush.mockResolvedValue({ ok: false, error: notInstalled });
      runEngineSetup.mockResolvedValue({ ...OK, ok: false });

      await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      expect(reflush).toHaveBeenCalledTimes(1);
    });

    it('answers a missing Equalizer APO at once, so its installer can start', async () => {
      engine = 'fluid';
      const missing = { errorCode: ErrorCode.EQUALIZER_APO_NOT_INSTALLED };
      reflush.mockResolvedValue({ ok: false, error: missing });

      const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['apo']);

      expect(reflush).toHaveBeenCalledTimes(1);
      expect(runEngineSetup).not.toHaveBeenCalled();
      expect(replied(reply)).toEqual(missing);
    });

    it('tries a switch whose neutralise threw again too', async () => {
      neutraliseEngine
        .mockRejectedValueOnce(new Error('locked'))
        .mockImplementation(async (other: TAudioEngine) => {
          order.push(`neutralise:${other}`);
          return 'written' as const;
        });

      const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      expect(replied(reply)).toEqual({ result: undefined });
      expect(switching).toBe(false);
    });
  });

  /**
   * One engine in Windows' effect lists at a time.
   *
   * Both engines can be registered on the same output, and then which one a
   * stream goes through depends on the slot each landed in and the mode the
   * stream uses — the case that reached a user was Equalizer APO's entry
   * running while the FluidEQ Engine's never did, both reported as attached.
   */
  describe('Equalizer APO while the FluidEQ Engine is chosen', () => {
    it('switches it off when it is on an output', async () => {
      isApoOnAnyOutput.mockResolvedValue(true);

      const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      expect(runEngineSetup).toHaveBeenCalledWith('suspend-apo', [
        '--restart-audio',
      ]);
      expect(replied(reply)).toEqual({ result: undefined });
    });

    it('leaves it alone when it is on no output', async () => {
      const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      expect(runEngineSetup).not.toHaveBeenCalledWith(
        'suspend-apo',
        expect.anything(),
      );
      expect(replied(reply)).toEqual({ result: undefined });
    });

    it('puts it back when Equalizer APO is chosen again', async () => {
      engine = 'fluid';
      isApoSwitchedOff.mockResolvedValue(true);

      await fire(ChannelEnum.SET_AUDIO_ENGINE, ['apo']);

      expect(runEngineSetup).toHaveBeenCalledWith('restore-apo', [
        '--restart-audio',
      ]);
    });

    it('asks for nothing when this app never switched it off', async () => {
      engine = 'fluid';

      await fire(ChannelEnum.SET_AUDIO_ENGINE, ['apo']);

      expect(runEngineSetup).not.toHaveBeenCalledWith(
        'restore-apo',
        expect.anything(),
      );
    });

    it('is not asked for once per try of a switch that had to be retried', async () => {
      isApoOnAnyOutput.mockResolvedValue(true);
      reflush
        .mockResolvedValueOnce({
          ok: false,
          error: { errorCode: ErrorCode.FLUID_ENGINE_NOT_INSTALLED },
        })
        .mockResolvedValue({ ok: true });

      await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      expect(
        runEngineSetup.mock.calls.filter(
          ([command]) => command === 'suspend-apo',
        ),
      ).toHaveLength(1);
    });

    it('keeps the switch when the Windows prompt is declined', async () => {
      isApoOnAnyOutput.mockResolvedValue(true);
      runEngineSetup.mockResolvedValue(DECLINED);

      const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      // The engine the user asked for, with the other one still registered:
      // exactly the state every version before this was in.
      expect(loadAudioEnginePreference(userDataDir).engine).toBe('fluid');
      expect(replied(reply)).toEqual({ result: undefined });
    });

    it('keeps the switch when the helper cannot be run at all', async () => {
      isApoOnAnyOutput.mockResolvedValue(true);
      runEngineSetup.mockImplementation(async (command: string) => {
        if (command === 'suspend-apo') {
          throw new Error('the helper is missing');
        }
        return OK;
      });

      const reply = await fire(ChannelEnum.SET_AUDIO_ENGINE, ['fluid']);

      expect(replied(reply)).toEqual({ result: undefined });
    });
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

  describe('the engine update', () => {
    // The outputs the engine is on were the user's choice; `--attach-all`
    // would put it on every one of them, including the ones taken off.
    it('replaces the engine and restarts audio, and touches no output', async () => {
      await fire(ChannelEnum.UPDATE_FLUID_ENGINE, []);

      expect(runEngineSetup).toHaveBeenCalledTimes(1);
      expect(runEngineSetup).toHaveBeenCalledWith('install', [
        '--restart-audio',
      ]);
    });

    it('calls it done once the installed engine is this build, then reflushes', async () => {
      const reply = await fire(ChannelEnum.UPDATE_FLUID_ENGINE, []);

      expect(order).toEqual(['status', 'reflush']);
      expect(replied(reply)).toEqual({ result: { ok: true, declined: false } });
    });

    // The helper saying it copied everything is not the files matching.
    it('does not call it done while the installed engine still differs', async () => {
      readAudioEngineStatus.mockResolvedValue({
        ...STATUS,
        fluidUpdateReady: true,
      });
      const reply = await fire(ChannelEnum.UPDATE_FLUID_ENGINE, []);

      expect(replied(reply)).toEqual({
        result: { ok: false, declined: false },
      });
    });

    it('says a declined prompt was declined, and changes nothing after it', async () => {
      runEngineSetup.mockResolvedValue(DECLINED);
      const reply = await fire(ChannelEnum.UPDATE_FLUID_ENGINE, []);

      expect(readAudioEngineStatus).not.toHaveBeenCalled();
      expect(reflush).not.toHaveBeenCalled();
      expect(replied(reply)).toEqual({ result: { ok: false, declined: true } });
    });

    it("passes the helper's own reason on when it ran and failed", async () => {
      runEngineSetup.mockResolvedValue({
        ok: false,
        declined: false,
        error: 'could not copy FluidEQ-Engine.dll: Access is denied. (5)',
        endpoints: [],
      });
      const reply = await fire(ChannelEnum.UPDATE_FLUID_ENGINE, []);

      expect(reflush).not.toHaveBeenCalled();
      expect(replied(reply)).toEqual({
        result: {
          ok: false,
          declined: false,
          detail: 'could not copy FluidEQ-Engine.dll: Access is denied. (5)',
        },
      });
    });

    it('answers a failure rather than no answer when the check itself throws', async () => {
      readAudioEngineStatus.mockRejectedValue(new Error('status unreadable'));
      const reply = await fire(ChannelEnum.UPDATE_FLUID_ENGINE, []);

      expect(replied(reply)).toEqual({ errorCode: ErrorCode.FAILURE });
    });
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
    expect(replied(reply)).toEqual({ result: 'rejected' });
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
    expect(replied(reply)).toEqual({ result: 'written' });
  });

  // A rack write scheduled mid-switch would land in the directory
  // `neutraliseEngine` is in the middle of emptying, after its own delete —
  // resurrecting the file the switch just removed.
  it('refuses a rack write while a switch is in progress', async () => {
    engine = 'fluid';
    switching = true;
    const reply = await fire(ChannelEnum.SET_SYSTEM_DSP_CHAIN, [
      encodeChainSettings(DSP_DEFAULTS),
    ]);

    expect(getConfigPath).not.toHaveBeenCalled();
    expect(writeSystemDspChain).not.toHaveBeenCalled();
    expect(replied(reply)).toEqual({ result: 'not-fluid' });
  });

  it('writes no rack under Equalizer APO', async () => {
    const reply = await fire(ChannelEnum.SET_SYSTEM_DSP_CHAIN, [
      encodeChainSettings(DSP_DEFAULTS),
    ]);

    expect(writeSystemDspChain).not.toHaveBeenCalled();
    expect(replied(reply)).toEqual({ result: 'not-fluid' });
  });

  // `getConfigPath('fluid')` creates the directory it returns, so asking it
  // about an engine that is not there leaves a config folder under
  // %ProgramData% on a machine with nothing to read it.
  it('asks for no directory when the engine is chosen but missing', async () => {
    engine = 'fluid';
    isEngineInstalled.mockResolvedValue(false);

    const reply = await fire(ChannelEnum.SET_SYSTEM_DSP_CHAIN, [
      encodeChainSettings(DSP_DEFAULTS),
    ]);

    expect(getConfigPath).not.toHaveBeenCalled();
    expect(writeSystemDspChain).not.toHaveBeenCalled();
    expect(replied(reply)).toEqual({ result: 'not-installed' });
  });
});
