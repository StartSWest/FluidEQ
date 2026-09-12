/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import ChannelEnum from 'common/channels';
import type { IAudioDevice } from 'common/constants';
import coalesceRequests from 'renderer/utils/coalescedRequest';
import { getAudioDevices, getMainPreAmp } from 'renderer/utils/equalizerApi';

interface IDeferred<Type> {
  promise: Promise<Type>;
  resolve: (value: Type) => void;
  reject: (reason: unknown) => void;
}

const deferred = <Type>(): IDeferred<Type> => {
  const settle: Pick<IDeferred<Type>, 'resolve' | 'reject'> = {
    resolve: () => undefined,
    reject: () => undefined,
  };
  const promise = new Promise<Type>((resolve, reject) => {
    settle.resolve = resolve;
    settle.reject = reject;
  });
  return { promise, ...settle };
};

/** A request whose every send is recorded and answered by hand. */
const controlledRequest = () => {
  const sent: IDeferred<string>[] = [];
  let refuse: Error | undefined;
  const request = jest.fn(() => {
    if (refuse) {
      throw refuse;
    }
    const reply = deferred<string>();
    sent.push(reply);
    return reply.promise;
  });
  const refuseNextSends = (error: Error | undefined) => {
    refuse = error;
  };
  return { request, sent, refuseNextSends };
};

/**
 * The preload bridge as Electron's emitter behaves: every one-shot listener on
 * a channel stays registered until a reply arrives, and one reply reaches
 * every listener waiting on that channel. The most listeners ever waiting at
 * once is what Node counts toward MaxListenersExceededWarning.
 */
const installBridge = () => {
  const listeners = new Map<string, Set<(arg: unknown) => void>>();
  const peak = new Map<string, number>();
  const sendMessage = jest.fn();
  window.electron = {
    ipcRenderer: {
      sendMessage,
      once: (channel: string, handler: (arg: unknown) => void) => {
        const waiting = listeners.get(channel) ?? new Set();
        listeners.set(channel, waiting);
        const listener = (arg: unknown) => {
          waiting.delete(listener);
          handler(arg);
        };
        waiting.add(listener);
        peak.set(channel, Math.max(peak.get(channel) ?? 0, waiting.size));
        return () => {
          waiting.delete(listener);
        };
      },
    },
  } as unknown as typeof window.electron;
  const reply = (channel: string, arg: unknown) => {
    [...(listeners.get(channel) ?? [])].forEach((listener) => listener(arg));
  };
  const sends = (channel: string) =>
    sendMessage.mock.calls.filter(([sentOn]) => sentOn === channel).length;
  return {
    reply,
    sends,
    peakListeners: (channel: string) => peak.get(channel),
  };
};

const SPEAKERS: IAudioDevice = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{SPEAKERS}',
  isDefault: true,
  isActive: true,
};

/**
 * One output change made eleven panels ask for the device list in the same
 * dispatch. Each ask was its own request and its own one-shot listener on the
 * shared reply channel, so the eleventh raised MaxListenersExceededWarning in
 * the window and main ran eleven PowerShell enumerations for one answer.
 */
describe('the device list asked for by many panels at once', () => {
  it('sends one request and waits on one listener for eleven asks', async () => {
    const bridge = installBridge();

    const asks = Array.from({ length: 11 }, () => getAudioDevices());

    expect(bridge.sends(ChannelEnum.GET_AUDIO_DEVICES)).toBe(1);
    expect(bridge.peakListeners(ChannelEnum.GET_AUDIO_DEVICES)).toBe(1);
    bridge.reply(ChannelEnum.GET_AUDIO_DEVICES, { result: [SPEAKERS] });
    await expect(Promise.all(asks)).resolves.toEqual(
      Array.from({ length: 11 }, () => [SPEAKERS]),
    );
  });

  // The positive control for the counts above: on the same bridge, a request
  // that is not coalesced shows one send and one listener per ask, so a count
  // of one is the coalescing and not a bridge that counts nothing.
  it('is measured on a bridge that does count every uncoalesced ask', async () => {
    const bridge = installBridge();

    const asks = Array.from({ length: 11 }, () => getMainPreAmp());

    expect(bridge.sends(ChannelEnum.GET_PREAMP)).toBe(11);
    expect(bridge.peakListeners(ChannelEnum.GET_PREAMP)).toBe(11);
    bridge.reply(ChannelEnum.GET_PREAMP, { result: -3 });
    await expect(Promise.all(asks)).resolves.toEqual(
      Array.from({ length: 11 }, () => -3),
    );
  });
});

describe('coalescing requests', () => {
  it('shares one request among callers in the turn that sent it', async () => {
    const { request, sent } = controlledRequest();
    const ask = coalesceRequests(request);

    const asks = [ask(), ask(), ask()];

    expect(request).toHaveBeenCalledTimes(1);
    sent[0].resolve('outputs');
    await expect(Promise.all(asks)).resolves.toEqual([
      'outputs',
      'outputs',
      'outputs',
    ]);
  });

  // A request already out may have been sent before whatever a later caller
  // is reacting to, such as a newly default output, so its answer is not
  // theirs to take.
  it('answers a later caller from a request sent after the current one settles', async () => {
    const { request, sent } = controlledRequest();
    const ask = coalesceRequests(request);

    const first = ask();
    await Promise.resolve();
    const later = [ask(), ask()];

    expect(request).toHaveBeenCalledTimes(1);
    sent[0].resolve('before the change');
    await expect(first).resolves.toBe('before the change');

    expect(request).toHaveBeenCalledTimes(2);
    sent[1].resolve('after the change');
    await expect(Promise.all(later)).resolves.toEqual([
      'after the change',
      'after the change',
    ]);
  });

  it('gives a caller asking again from its own continuation a fresh request', async () => {
    const { request, sent } = controlledRequest();
    const ask = coalesceRequests(request);

    const first = ask();
    const askedAgain = first.then(() => ask());
    sent[0].resolve('first');
    await first;

    expect(request).toHaveBeenCalledTimes(2);
    sent[1].resolve('second');
    await expect(askedAgain).resolves.toBe('second');
  });

  // The queued request has to go out in the same reaction that ends the one
  // before it: otherwise a continuation of the first request finds nothing in
  // flight and sends beside the queued one.
  it('never sends beside a queued request when a continuation asks again', async () => {
    const { request, sent } = controlledRequest();
    const ask = coalesceRequests(request);

    const first = ask();
    const askedAgain = first.then(() => ask());
    await Promise.resolve();
    const later = ask();
    sent[0].resolve('first');
    await first;

    expect(request).toHaveBeenCalledTimes(2);
    sent[1].resolve('second');
    await expect(later).resolves.toBe('second');
    await expect(askedAgain).resolves.toBe('second');
  });

  it('rejects only the failed request and still sends the queued one', async () => {
    const { request, sent } = controlledRequest();
    const ask = coalesceRequests(request);

    const first = ask();
    await Promise.resolve();
    const later = ask();
    sent[0].reject(new Error('enumeration failed'));
    await expect(first).rejects.toThrow('enumeration failed');

    expect(request).toHaveBeenCalledTimes(2);
    sent[1].resolve('recovered');
    await expect(later).resolves.toBe('recovered');
  });

  it('rejects queued callers when the bridge refuses to send, and recovers', async () => {
    const { request, sent, refuseNextSends } = controlledRequest();
    const ask = coalesceRequests(request);

    const first = ask();
    await Promise.resolve();
    const later = ask();
    refuseNextSends(new Error('bridge refused'));
    sent[0].resolve('first');
    // Both expectations are attached before any reaction runs, so the queued
    // rejection is never briefly unhandled.
    await Promise.all([
      expect(first).resolves.toBe('first'),
      expect(later).rejects.toThrow('bridge refused'),
    ]);

    refuseNextSends(undefined);
    const next = ask();
    expect(request).toHaveBeenCalledTimes(3);
    sent[1].resolve('sent again');
    await expect(next).resolves.toBe('sent again');
  });
});
