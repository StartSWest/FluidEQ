/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine's setup commands are the calls that wait on a person — a Windows
 * permission prompt — before main can answer. The ten-second deadline every
 * other request has used to reject them while the prompt was still on screen,
 * and the unhandled rejection replaced the whole window with the crash screen.
 * These pin that they wait however long it takes and never reject at all.
 */

import { ErrorCode } from 'common/errors';
import {
  attachFluidEngine,
  detachFluidEngine,
  installFluidEngine,
  isAwaitingApoInstall,
} from 'renderer/utils/audioEngineApi';
import { getMainPreAmp } from 'renderer/utils/equalizerApi';

let listener: ((arg: unknown) => void) | undefined;
const unsubscribe = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  listener = undefined;
  unsubscribe.mockClear();
  window.electron = {
    ipcRenderer: {
      sendMessage: jest.fn(),
      once: (_channel: string, handler: (arg: unknown) => void) => {
        listener = handler;
        return unsubscribe;
      },
    },
  } as unknown as typeof window.electron;
});

afterEach(() => {
  jest.useRealTimers();
});

const done = { ok: true, declined: false, endpoints: [] };

describe.each([
  ['install', () => installFluidEngine()],
  ['attach', () => attachFluidEngine('{SPEAKERS}')],
  ['detach', () => detachFluidEngine('{SPEAKERS}')],
])('the engine %s command', (_name, call) => {
  it('outlasts a permission prompt left open for minutes', async () => {
    const pending = call();
    const settled = jest.fn();
    pending.then(settled, settled);

    jest.advanceTimersByTime(5 * 60 * 1000);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(unsubscribe).not.toHaveBeenCalled();

    listener?.({ result: done });
    await expect(pending).resolves.toEqual(done);
  });

  it('answers a failure with a failed result, never a rejection', async () => {
    const pending = call();
    listener?.({ errorCode: ErrorCode.FAILURE });
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.declined).toBe(false);
    expect(result.endpoints).toEqual([]);
  });
});

it('leaves every other request its ten-second deadline', async () => {
  // A positive control: the deadline itself still works, so the checks above
  // are about the engine calls opting out and not about timers being broken.
  const pending = getMainPreAmp();
  const rejected = jest.fn();
  pending.catch(rejected);
  jest.advanceTimersByTime(10_000);
  await Promise.resolve();
  expect(rejected).toHaveBeenCalled();
});

describe('isAwaitingApoInstall', () => {
  const apoMissing = Object.assign(new Error('Equalizer APO is missing'), {
    code: ErrorCode.EQUALIZER_APO_NOT_INSTALLED,
  });

  it('lets a switch to an Equalizer APO still to be installed go on', () => {
    expect(isAwaitingApoInstall(apoMissing, { fluid: false, apo: true })).toBe(
      true,
    );
  });

  it('does not excuse the same error when no install was going to follow', () => {
    expect(isAwaitingApoInstall(apoMissing, { fluid: false, apo: false })).toBe(
      false,
    );
  });

  it('does not excuse any other failure', () => {
    const other = Object.assign(new Error('no'), { code: ErrorCode.FAILURE });
    expect(isAwaitingApoInstall(other, { fluid: false, apo: true })).toBe(
      false,
    );
    expect(isAwaitingApoInstall('nope', { fluid: false, apo: true })).toBe(
      false,
    );
  });
});
