/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Just enough of an `AudioContext` for `karaokeAudioClock`, with a clock that
 * moves only when a test moves it.
 *
 * jsdom has no Web Audio at all. The clock asks for silent
 * `ConstantSourceNode`s, starts and stops them at times on `currentTime`, and
 * waits for their `ended`; this keeps those times and fires the `ended`s in
 * order as `advance` carries the clock past them. Like a real context, its
 * time stands still while it is suspended.
 */
export interface IFakeClockMarker {
  offset: { value: number };
  onended: (() => void) | null;
  startAt: number | undefined;
  stopAt: number | undefined;
  isConnected: boolean;
  hasEnded: boolean;
  connect: () => void;
  disconnect: () => void;
  start: (when?: number) => void;
  stop: (when?: number) => void;
}

/** A `ConstantSourceNode` as far as its start, stop and `ended` go. */
const createMarker = (clock: { currentTime: number }): IFakeClockMarker => {
  const marker: IFakeClockMarker = {
    offset: { value: 1 },
    onended: null,
    startAt: undefined,
    stopAt: undefined,
    isConnected: false,
    hasEnded: false,
    connect: () => {
      marker.isConnected = true;
    },
    disconnect: () => {
      marker.isConnected = false;
    },
    start: (when = 0) => {
      if (marker.startAt !== undefined) {
        throw new DOMException('start twice', 'InvalidStateError');
      }
      marker.startAt = when;
    },
    stop: (when = 0) => {
      if (marker.startAt === undefined) {
        throw new DOMException('stop before start', 'InvalidStateError');
      }
      if (!marker.hasEnded) {
        marker.stopAt = Math.max(when, clock.currentTime);
      }
    },
  };
  return marker;
};

export class FakeClockContext {
  state: AudioContextState = 'suspended';

  currentTime = 0;

  readonly destination = {};

  readonly markers: IFakeClockMarker[] = [];

  resumes = 0;

  suspends = 0;

  resume() {
    if (this.state === 'closed') {
      return Promise.reject(new DOMException('closed', 'InvalidStateError'));
    }
    this.resumes += 1;
    this.state = 'running';
    return Promise.resolve();
  }

  suspend() {
    if (this.state !== 'closed') {
      this.suspends += 1;
      this.state = 'suspended';
    }
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }

  createConstantSource() {
    const marker = createMarker(this);
    this.markers.push(marker);
    return marker;
  }

  /** Markers started and not yet ended. */
  get pending(): IFakeClockMarker[] {
    return this.markers.filter(
      (marker) => marker.startAt !== undefined && !marker.hasEnded,
    );
  }

  /**
   * Carries the clock `seconds` on, ending each marker whose stop time it
   * passes at that time and in that order — markers made by an `ended` on
   * the way included. A suspended or closed context does not move.
   */
  advance(seconds: number) {
    if (this.state !== 'running') {
      return;
    }
    const target = this.currentTime + seconds;
    for (;;) {
      const due = this.pending
        .filter(
          (marker) => marker.stopAt !== undefined && marker.stopAt <= target,
        )
        .sort((left, right) => (left.stopAt ?? 0) - (right.stopAt ?? 0))[0];
      if (!due || this.state !== 'running') {
        break;
      }
      this.currentTime = Math.max(this.currentTime, due.stopAt ?? 0);
      due.hasEnded = true;
      due.onended?.();
    }
    if (this.state === 'running') {
      this.currentTime = target;
    }
  }
}

/** What `createKaraokeAudioClock` takes, from a fake. */
export const openFakeClock = (context: FakeClockContext) => () =>
  context as unknown as AudioContext;
