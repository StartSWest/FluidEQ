/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';

/**
 * The sound card's clock, for the karaoke tab's musical waits: a count-in, and
 * an audition that plays a stretch of the song and stops.
 *
 * All of them were `setTimeout`s. A count-in is a tempo — "1, 2, 3, go" 550 ms
 * apart and then the song — and a timer is not a clock: each step ran when the
 * window's task queue got round to it, late by however busy the thread was,
 * and a chain of them carried every step's lateness into the next, so the "go"
 * a singer counts towards moved with whatever else the window was doing. A
 * hidden window runs timers once a second at best. The audio clock is the one
 * the song itself is played against, advances whatever the window is doing,
 * and is read to within one render quantum (128 frames, under 3 ms).
 *
 * A wait is a silent `ConstantSourceNode` told to stop at a time on that
 * clock, and its `ended` event is what runs the cue. Every cue of one
 * schedule is measured from the same origin, so they cannot drift apart.
 *
 * The context is opened on the first wait, not at mount, and suspended
 * whenever nothing is waiting: a running context keeps the output device open
 * and its render thread awake for as long as it exists, which is a cost the
 * karaoke tab has no business paying while nobody is counting anything.
 */
export interface IKaraokeClockCue {
  /** Seconds past the schedule's origin. */
  atSeconds: number;
  run: () => void;
}

export interface IKaraokeAudioClock {
  /**
   * Runs each cue once the clock is `atSeconds` past the moment it is next
   * running — at once, when it already is.
   *
   * `plan` is asked at that moment rather than now: a clock that has to be
   * resumed first starts some milliseconds later, and a caller measuring from
   * something that moves in real time — a media element's playhead — has to
   * measure from the instant both are moving. An empty plan finishes at once.
   *
   * Returns the cancel, which also silences any cue not yet run.
   */
  schedule: (plan: () => readonly IKaraokeClockCue[]) => () => void;
  /** Lets the device go for good; a later schedule opens a new context. */
  close: () => void;
}

export type TOpenKaraokeAudioContext = () => AudioContext | undefined;

const openInteractiveContext: TOpenKaraokeAudioContext = () =>
  typeof AudioContext === 'undefined'
    ? undefined
    : new AudioContext({ latencyHint: 'interactive' });

export const createKaraokeAudioClock = (
  open: TOpenKaraokeAudioContext = openInteractiveContext,
): IKaraokeAudioClock => {
  let context: AudioContext | undefined;
  /** Schedules neither finished nor cancelled. The device is kept for these. */
  let waiting = 0;
  /** Each unfinished schedule's cancel, for `close`. */
  const pending = new Set<{ cancel?: () => void }>();

  const settle = () => {
    waiting -= 1;
    // After the turn, not at once: a wait cancelled to be replaced in the
    // same turn — an audition started over, a count-in pressed again — would
    // otherwise stop the device and start it again between the two.
    queueMicrotask(() => {
      if (waiting === 0 && context?.state === 'running') {
        context.suspend().catch(() => undefined);
      }
    });
  };

  const schedule: IKaraokeAudioClock['schedule'] = (plan) => {
    if (!context || context.state === 'closed') {
      context = open();
    }
    const clockContext = context;
    if (!clockContext) {
      // No Web Audio at all — a test environment, never Chromium. Nothing
      // can be timed, so the cues run in order now rather than never: a
      // count-in that never reached "go" would hold the song forever.
      plan()
        .slice()
        .sort((left, right) => left.atSeconds - right.atSeconds)
        .forEach((cue) => cue.run());
      return () => undefined;
    }
    waiting += 1;
    let isOver = false;
    const markers: ConstantSourceNode[] = [];
    const entry: { cancel?: () => void } = {};
    const finish = () => {
      if (isOver) {
        return false;
      }
      isOver = true;
      pending.delete(entry);
      settle();
      return true;
    };
    const cancel = () => {
      if (!finish()) {
        return;
      }
      markers.forEach((marker) => {
        // Stopped now so it ends and is let go of; its cue is not run.
        try {
          marker.stop();
        } catch {
          marker.disconnect();
        }
      });
    };
    entry.cancel = cancel;
    pending.add(entry);

    const start = () => {
      if (isOver || clockContext.state !== 'running') {
        // Cancelled while the device was waking, or closed under it.
        finish();
        return;
      }
      const origin = clockContext.currentTime;
      const cues = plan();
      if (!cues.length) {
        finish();
        return;
      }
      let left = cues.length;
      cues.forEach((cue) => {
        const marker = clockContext.createConstantSource();
        // Silent, but connected: Chromium only renders — and so only ever
        // reaches the stop time of — a node that leads to the destination.
        marker.offset.value = 0;
        marker.connect(clockContext.destination);
        marker.onended = () => {
          marker.onended = null;
          marker.disconnect();
          left -= 1;
          if (isOver) {
            return;
          }
          try {
            cue.run();
          } finally {
            // After the cue, so a cue that schedules the next wait keeps the
            // device awake instead of suspending it between the two.
            if (left === 0) {
              finish();
            }
          }
        };
        markers.push(marker);
        marker.start(origin);
        marker.stop(origin + Math.max(0, cue.atSeconds));
      });
    };
    // Resolves once the context is running: at once when it is, after the
    // device has started when it was suspended, and after a pending suspend
    // when one is still on its way.
    clockContext
      .resume()
      .then(start)
      .catch(() => {
        finish();
      });
    return cancel;
  };

  const close = () => {
    [...pending].forEach((entry) => entry.cancel?.());
    const closing = context;
    context = undefined;
    waiting = 0;
    if (closing && closing.state !== 'closed') {
      closing.close().catch(() => undefined);
    }
  };

  return { schedule, close };
};

/** One clock for a component's lifetime, closed when it unmounts. */
export const useKaraokeAudioClock = (): IKaraokeAudioClock => {
  const [clock] = useState(() => createKaraokeAudioClock());
  useEffect(() => () => clock.close(), [clock]);
  return clock;
};
