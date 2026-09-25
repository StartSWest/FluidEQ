/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

type TSettle = {
  resolve: () => void;
  reject: (reason: unknown) => void;
};

/**
 * One call in flight at a time, and of the calls that arrive meanwhile, only
 * the newest.
 *
 * For a write whose every value replaces the last — a strength dragged along
 * a slider, a gain on a fader — where each call is a config rewrite that
 * Equalizer APO then reloads. Those were debounced: a timer restarted by every
 * step, writing once the thumb had been still for a quarter of a second. A
 * quarter of a second is a guess at how fast somebody drags, and the write it
 * guarded was already telling us the one thing that matters, which is when it
 * was done. So the first value goes at once, the values that arrive while it
 * is on its way replace each other, and the newest goes the moment the one in
 * flight settles. The last value a drag ends on is always written, and never
 * more than one write is waiting behind another.
 *
 * Each call's promise settles with the write that carried its value: the one
 * sent for it, or — for a value replaced while it waited — at once, with
 * nothing to report, because it was never going to be written.
 */
const latestCall = <Args extends unknown[]>(
  run: (...args: Args) => Promise<void> | void,
): ((...args: Args) => Promise<void>) => {
  let isInFlight = false;
  let waiting: { args: Args; settle: TSettle } | undefined;

  const start = (args: Args, settle: TSettle) => {
    isInFlight = true;
    const sendWaiting = () => {
      isInFlight = false;
      const queued = waiting;
      waiting = undefined;
      if (queued) {
        start(queued.args, queued.settle);
      }
    };
    // Through a promise, so a writer that throws before it returns one
    // reaches its caller the same way as one that rejects.
    new Promise<void>((resolve) => {
      resolve(run(...args));
    })
      .then(
        () => {
          settle.resolve();
          return undefined;
        },
        (error: unknown) => {
          settle.reject(error);
          return undefined;
        },
      )
      .finally(sendWaiting);
  };

  return (...args: Args) =>
    new Promise<void>((resolve, reject) => {
      if (!isInFlight) {
        start(args, { resolve, reject });
        return;
      }
      waiting?.settle.resolve();
      waiting = { args, settle: { resolve, reject } };
    });
};

export default latestCall;
