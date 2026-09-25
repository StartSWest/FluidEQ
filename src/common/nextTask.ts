/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Waits for the next task: how a long loop on the window's own thread gives
 * it back between chunks, in a window that is minimised as much as in one on
 * screen.
 *
 * Not `requestAnimationFrame`, which the track and chord analyses yielded on
 * first. The main window is built with `backgroundThrottling`, so a minimised
 * or covered window runs no frames at all, and a loop that waited for one
 * parked after its first chunk holding everything it had decoded — a whole
 * song's samples, about 85 MB for four minutes of 44.1 kHz stereo, per job,
 * with a new job on every track change and the old one unable to see its
 * cancellation until a frame came. Not a timer either: a hidden page runs
 * those once a second at best. A message posted to ourselves is neither — it
 * arrives as the next task whether or not anything is painted, and a paint or
 * a key press already queued runs before it.
 *
 * With a signal it also ends the moment the job is cancelled, so a loop that
 * checks its signal after the wait lets go of its buffers at once.
 *
 * Where there is no `MessageChannel` — Jest's jsdom has none; Chromium and
 * Node both do — it ends on the next microtask, which yields nothing.
 */
const nextTask = (signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted || typeof MessageChannel === 'undefined') {
      resolve();
      return;
    }
    const channel = new MessageChannel();
    const done = () => {
      channel.port1.onmessage = null;
      channel.port1.close();
      signal?.removeEventListener('abort', done);
      resolve();
    };
    channel.port1.onmessage = done;
    signal?.addEventListener('abort', done, { once: true });
    channel.port2.postMessage(undefined);
  });

export default nextTask;
