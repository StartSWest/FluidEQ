/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

type TListener = (...args: unknown[]) => void;

export interface ISentMessage {
  channel: string;
  args: unknown[];
  /** What the window gave main to hand back with the reply, if anything. */
  requestId: unknown;
}

/**
 * The preload bridge's messaging, behaving the way Electron's emitter does.
 *
 * Every listener on a channel hears every message sent to it, and nothing is
 * delivered synchronously from a send. The most listeners ever registered on a
 * channel at once is kept, because that is what Node counts toward
 * MaxListenersExceededWarning.
 */
const installFakeIpcRenderer = () => {
  const listeners = new Map<string, TListener[]>();
  const peak = new Map<string, number>();
  const sent: ISentMessage[] = [];

  const add = (channel: string, listener: TListener) => {
    const onChannel = [...(listeners.get(channel) ?? []), listener];
    listeners.set(channel, onChannel);
    peak.set(channel, Math.max(peak.get(channel) ?? 0, onChannel.length));
    return () => {
      listeners.set(
        channel,
        (listeners.get(channel) ?? []).filter((each) => each !== listener),
      );
    };
  };

  const ipcRenderer = {
    sendMessage: (channel: string, args: unknown[], requestId?: unknown) => {
      sent.push({ channel, args, requestId });
    },
    on: (channel: string, listener: TListener) => add(channel, listener),
  };
  // Defined rather than assigned: a case before this one may have left
  // `window.electron` as a read-only property.
  Object.defineProperty(window, 'electron', {
    configurable: true,
    writable: true,
    value: { ipcRenderer },
  });

  /** A message from main: every listener registered right now hears it. */
  const reply = (channel: string, ...args: unknown[]) => {
    [...(listeners.get(channel) ?? [])].forEach((listener) =>
      listener(...args),
    );
  };

  return {
    sent,
    reply,
    /**
     * Main answering one request the way its handlers do: the payload on the
     * reply channel, followed by whatever id the request carried.
     */
    answer: (
      message: ISentMessage,
      payload: unknown,
      replyChannel: string = message.channel,
    ) => reply(replyChannel, payload, message.requestId),
    sentOn: (channel: string) =>
      sent.filter((message) => message.channel === channel),
    listenerCount: (channel: string) => (listeners.get(channel) ?? []).length,
    peakListeners: (channel: string) => peak.get(channel) ?? 0,
  };
};

export default installFakeIpcRenderer;
