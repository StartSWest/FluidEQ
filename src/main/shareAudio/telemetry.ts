/* FluidEQ — GPL-3.0-or-later */
import type { TAudioEvent, TAudioResponse } from './protocol';

/** A busy host gets one in-flight sample and the newest pending sample per
 * lane. Audio never waits for its meters, and a stalled UI cannot accumulate
 * a PCM/message history in the worker or Node's unbounded MessagePort queue. */
export const createAudioTelemetry = (
  post: (message: TAudioResponse) => void,
  onOverflow?: () => void,
) => {
  const inFlight = new Set<string>();
  const latest = new Map<string, TAudioEvent>();
  const reliable: TAudioEvent[] = [];
  const send = (key: string, event: TAudioEvent) => {
    if (inFlight.has(key)) {
      latest.set(key, event);
    } else {
      if (inFlight.size >= 256) {
        return;
      }
      inFlight.add(key);
      post({ type: 'event', event, credit: key });
    }
  };
  const sendReliable = (event: TAudioEvent) => {
    if (inFlight.has('control')) {
      if (reliable.length >= 128) {
        onOverflow?.();
        throw new Error('Share Audio event queue is full.');
      }
      reliable.push(event);
    } else {
      inFlight.add('control');
      post({ type: 'event', event, credit: 'control' });
    }
  };
  return {
    send,
    sendReliable,
    credit(key: string) {
      inFlight.delete(key);
      if (key === 'control') {
        const event = reliable.shift();
        if (event) {
          sendReliable(event);
        }
        return;
      }
      const event = latest.get(key);
      latest.delete(key);
      if (event) {
        send(key, event);
      }
    },
    forget(key: string) {
      latest.delete(key);
    },
  };
};
