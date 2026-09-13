/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import {
  getMainPreAmp,
  setGain,
  setMainPreAmp,
} from 'renderer/utils/equalizerApi';
import installFakeIpcRenderer from '../../utils/fakeIpcRenderer';

/**
 * How a request ended, captured from the moment it is made, so a rejection
 * that lands before the assertion is never briefly unhandled.
 */
const settle = (request: Promise<unknown>) =>
  request.then(
    (value: unknown) => ({ value }),
    (error: unknown) => ({ error }),
  );

const failedWith = (code: ErrorCode) => ({
  error: expect.objectContaining({ code }),
});

/**
 * A reply has to reach the request that asked for it, and no other.
 *
 * Replies used to be matched to requests by channel alone. Every request
 * waiting on a channel heard the first reply to arrive on it, so two
 * overlapping writes on one channel — a slider dragged, a value typed twice —
 * could both be told the outcome of whichever main finished first, and a
 * request that had already timed out left its late reply to be taken as the
 * answer to the next request on that channel.
 */
describe('matching replies to the requests that asked', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('answers each of two overlapping requests on one channel with its own outcome', async () => {
    const bridge = installFakeIpcRenderer();

    const refused = setMainPreAmp(-3);
    const accepted = setMainPreAmp(-4);
    const [first, second] = bridge.sentOn(ChannelEnum.SET_PREAMP);

    const refusedOutcome = settle(refused);
    const acceptedOutcome = settle(accepted);
    // Main finishes the second write before the first, and only the first
    // fails.
    bridge.answer(second, { result: undefined });
    bridge.answer(first, { errorCode: ErrorCode.FAILURE });

    expect(await acceptedOutcome).toEqual({ value: undefined });
    expect(await refusedOutcome).toEqual(failedWith(ErrorCode.FAILURE));
  });

  it('does not hand a timed-out request’s late reply to the next request on its channel', async () => {
    jest.useFakeTimers();
    const bridge = installFakeIpcRenderer();

    const staleOutcome = settle(getMainPreAmp());
    jest.advanceTimersByTime(10_000);
    expect(await staleOutcome).toEqual(failedWith(ErrorCode.TIMEOUT));

    const fresh = getMainPreAmp();
    const [staleMessage, freshMessage] = bridge.sentOn(ChannelEnum.GET_PREAMP);
    // The reply to the request that gave up arrives only now, ahead of the
    // reply to the request that is still waiting.
    bridge.answer(staleMessage, { result: -12 });
    bridge.answer(freshMessage, { result: -6 });

    await expect(fresh).resolves.toBe(-6);
  });

  it('leaves a request waiting when a reply names some other request', async () => {
    const bridge = installFakeIpcRenderer();

    const earlier = getMainPreAmp();
    const later = getMainPreAmp();
    const [earlierMessage, laterMessage] = bridge.sentOn(
      ChannelEnum.GET_PREAMP,
    );
    const settled = jest.fn();
    earlier.then(settled, settled);

    bridge.answer(laterMessage, { result: -1 });
    await expect(later).resolves.toBe(-1);
    expect(settled).not.toHaveBeenCalled();

    bridge.answer(earlierMessage, { result: -2 });
    await expect(earlier).resolves.toBe(-2);
  });

  it('waits on one listener however many requests overlap on a channel', async () => {
    const bridge = installFakeIpcRenderer();

    const asks = Array.from({ length: 11 }, () => getMainPreAmp());

    expect(bridge.sentOn(ChannelEnum.GET_PREAMP)).toHaveLength(11);
    expect(bridge.peakListeners(ChannelEnum.GET_PREAMP)).toBe(1);
    bridge
      .sentOn(ChannelEnum.GET_PREAMP)
      .forEach((message, index) => bridge.answer(message, { result: index }));
    await expect(Promise.all(asks)).resolves.toEqual(
      Array.from({ length: 11 }, (_, index) => index),
    );
    // Nothing is left listening once every request has its answer.
    expect(bridge.listenerCount(ChannelEnum.GET_PREAMP)).toBe(0);
  });

  it('stops listening for a request that timed out', async () => {
    jest.useFakeTimers();
    const bridge = installFakeIpcRenderer();

    const outcome = settle(getMainPreAmp());
    jest.advanceTimersByTime(10_000);
    expect(await outcome).toEqual(failedWith(ErrorCode.TIMEOUT));

    expect(bridge.listenerCount(ChannelEnum.GET_PREAMP)).toBe(0);
  });

  // A band's writes are answered on a channel of their own, named after the
  // band; overlapping writes to two bands must each still hear their own.
  it('hears a band’s reply on that band’s own reply channel', async () => {
    const bridge = installFakeIpcRenderer();

    const low = setGain('low', 2);
    const high = setGain('high', -2);
    const [lowMessage, highMessage] = bridge.sentOn(
      ChannelEnum.SET_FILTER_GAIN,
    );

    const highOutcome = settle(high);
    const lowOutcome = settle(low);
    bridge.answer(
      highMessage,
      { errorCode: ErrorCode.INVALID_PARAMETER },
      `${ChannelEnum.SET_FILTER_GAIN}high`,
    );
    bridge.answer(
      lowMessage,
      { result: undefined },
      `${ChannelEnum.SET_FILTER_GAIN}low`,
    );

    expect(await highOutcome).toEqual(failedWith(ErrorCode.INVALID_PARAMETER));
    expect(await lowOutcome).toEqual({ value: undefined });
  });

  it('throws before listening when the bridge refuses to send', () => {
    const bridge = installFakeIpcRenderer();
    const refusal = new Error('bridge refused');
    window.electron.ipcRenderer.sendMessage = () => {
      throw refusal;
    };

    expect(() => getMainPreAmp()).toThrow(refusal);
    expect(bridge.listenerCount(ChannelEnum.GET_PREAMP)).toBe(0);
  });
});
