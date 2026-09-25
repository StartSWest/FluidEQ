/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The engine's setup commands are the calls that wait on a person — a Windows
 * permission prompt — before main can answer. The ten-second deadline every
 * request had used to reject them while the prompt was still on screen, and
 * the unhandled rejection replaced the whole window with the crash screen.
 * No request has a deadline now; these pin that the setup commands wait
 * however long it takes and never reject at all.
 */

import { ErrorCode } from 'common/errors';
import ChannelEnum from 'common/channels';
import {
  attachFluidEngine,
  detachFluidEngine,
  installFluidEngine,
  isAwaitingApoInstall,
  updateFluidEngine,
} from 'renderer/utils/audioEngineApi';
import { getMainPreAmp } from 'renderer/utils/equalizerApi';
import installFakeIpcRenderer from '../../utils/fakeIpcRenderer';

let bridge: ReturnType<typeof installFakeIpcRenderer>;

/** Main answering the most recent request, on that request's own channel. */
const answerLatest = (payload: unknown) => {
  bridge.answer(bridge.sent[bridge.sent.length - 1], payload);
};

/** Whether the most recent request is still being listened for. */
const isLatestAwaited = () =>
  bridge.listenerCount(bridge.sent[bridge.sent.length - 1].channel) > 0;

beforeEach(() => {
  jest.useFakeTimers();
  bridge = installFakeIpcRenderer();
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
    expect(isLatestAwaited()).toBe(true);

    answerLatest({ result: done });
    await expect(pending).resolves.toEqual(done);
  });

  it('answers a failure with a failed result, never a rejection', async () => {
    const pending = call();
    answerLatest({ errorCode: ErrorCode.FAILURE });
    const result = await pending;
    expect(result.ok).toBe(false);
    expect(result.declined).toBe(false);
    expect(result.endpoints).toEqual([]);
  });
});

// The update waits on the same prompt, and answers the way "Restart Windows
// audio" does, because that is how it ends.
describe('the engine update', () => {
  it('asks main on its own channel', async () => {
    const pending = updateFluidEngine();
    expect(bridge.sentOn(ChannelEnum.UPDATE_FLUID_ENGINE)).toEqual([
      expect.objectContaining({ args: [] }),
    ]);
    // Answered, because a request with no deadline left waiting would still
    // be listening on the bridge this case installed when the next case asks.
    answerLatest({ result: { ok: true, declined: false } });
    await pending;
  });

  it('outlasts a permission prompt left open for minutes', async () => {
    const pending = updateFluidEngine();
    const settled = jest.fn();
    pending.then(settled, settled);

    jest.advanceTimersByTime(5 * 60 * 1000);
    await Promise.resolve();
    expect(settled).not.toHaveBeenCalled();
    expect(isLatestAwaited()).toBe(true);

    answerLatest({ result: { ok: true, declined: false } });
    await expect(pending).resolves.toEqual({ ok: true, declined: false });
  });

  it('answers a failure with a failed outcome and its reason, never a rejection', async () => {
    const pending = updateFluidEngine();
    answerLatest({
      errorCode: ErrorCode.FAILURE,
      detail: 'the helper crashed',
    });
    await expect(pending).resolves.toEqual({
      ok: false,
      declined: false,
      detail: 'the helper crashed',
    });
  });
});

it('settles any request the moment main answers, however late', async () => {
  // A positive control: the checks above see a request still waiting, and
  // this one sees a request settle, so "still waiting" is not simply a
  // harness in which nothing ever settles.
  const pending = getMainPreAmp();
  const settled = jest.fn();
  pending.then(settled, settled);
  jest.advanceTimersByTime(5 * 60 * 1000);
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);

  answerLatest({ result: -6 });
  await expect(pending).resolves.toBe(-6);
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
