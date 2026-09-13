/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * One request on the wire at a time, however many callers want its answer.
 *
 * For a request whose every answer costs main real work. One output change
 * makes eleven panels ask for the device list at once, and each ask used to be
 * its own request — eleven PowerShell enumerations in main for one answer, and
 * eleven listeners in the window, the eleventh of which was Node's
 * MaxListenersExceededWarning. Replies now find their requests by id over one
 * listener per channel (`sendRequest`), so the listeners are no longer the
 * cost; the enumerations still are.
 *
 * Callers in the turn that sent the request share it. That is the burst
 * itself — every panel is called from the one dispatch of the output change —
 * and nothing they are reacting to can postdate it: this window only learns of
 * a change outside itself from a message, and a message is a later turn.
 *
 * A caller from a later turn does not take that answer, because the request
 * may have gone out before whatever the caller is reacting to — a newly
 * default output among them. It shares the single request sent as soon as the
 * current one settles. So every answer handed out was asked for after its
 * caller had reason to ask, a burst costs one request, and a burst overlapping
 * one already out costs two.
 */
const coalesceRequests = <Type>(
  request: () => Promise<Type>,
): (() => Promise<Type>) => {
  let inFlight: Promise<Type> | undefined;
  let isSentThisTurn = false;
  let queued: Promise<Type> | undefined;
  let sendQueued: (() => void) | undefined;

  const send = () => {
    const sent = request();
    inFlight = sent;
    isSentThisTurn = true;
    // Microtasks queued before this one were resolved before the request went
    // out, so their callers still join; anything resolved later queues after.
    queueMicrotask(() => {
      isSentThisTurn = false;
    });
    // The queued request goes out inside the same reaction that clears this
    // one, and that reaction is registered before any caller can chain on
    // `sent`. Were there a tick between the two, a caller's own continuation
    // would find nothing in flight and send beside the queued request, and
    // whichever of those settled first would mark the other as finished.
    const settle = () => {
      inFlight = undefined;
      const release = sendQueued;
      queued = undefined;
      sendQueued = undefined;
      release?.();
    };
    sent.then(settle, settle);
    return sent;
  };

  return () => {
    if (!inFlight) {
      return send();
    }
    if (isSentThisTurn) {
      return inFlight;
    }
    queued ??= new Promise<Type>((resolve, reject) => {
      sendQueued = () => {
        try {
          resolve(send());
        } catch (error) {
          // The bridge refused synchronously; the queued callers hear it as
          // the direct caller of a first request would.
          reject(error);
        }
      };
    });
    return queued;
  };
};

export default coalesceRequests;
