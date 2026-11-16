/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { DECK_ENDED, DECK_READY } from '../../common/dsp/deckState';
import {
  IPendingSeek,
  holdSeek,
  seekAnswered,
  seekSettled,
} from '../library/player/pendingSeek';

/**
 * The song's place while the Library's native player plays it, read as finely
 * as the lyrics and the pitch lane draw it — every frame.
 *
 * The Library reads the host's telemetry rounded to a quarter second, which is
 * all a seek bar needs (`nativeTransport.ts`). A sung word lasts less than
 * that, and a lyric wipe moving in quarter-second steps is a broken one. So
 * the raw position each frame carries is kept, with the moment it arrived,
 * and read forward from there by the time since: frames come about forty
 * times a second, so the reading is never more than one frame's worth of
 * guessing ahead of the truth, and the next frame corrects it.
 *
 * Two things the element's clock did for free are done here by hand. It
 * reported what was HEARD: Chromium takes the output's delay off its media
 * time. The deck's position is what the host has taken from the file, which
 * then spends the rack's latency and the device's buffer on its way out, so
 * both are taken off — or every word would light up early by the Maximizer's
 * look-ahead and a device period. And it never went backwards while playing;
 * a reading that would step back by less than a frame's jitter holds where it
 * was instead, so the lane does not shiver.
 */
export interface IKaraokeHostFrame {
  deckState: number;
  deckPositionSeconds: number;
  deckDurationSeconds: number;
  /** The device's buffer, in frames of `sampleRate`. */
  latencyFrames: number;
  sampleRate: number;
  /** The rack's own delay, every stage together. */
  processingLatency?: { rate: number; frames: number };
}

export interface IKaraokeHostClock {
  /** A telemetry frame, arrived at `now` (ms, `performance.now()`). */
  take: (frame: IKaraokeHostFrame, now: number) => void;
  /** A deck took the track, cued here, ahead of its first frame. */
  cued: (positionSeconds: number, now: number) => void;
  /** The listener asked to be here; held until the host has answered. */
  seek: (positionMs: number) => IPendingSeek;
  /** The host's answer to that seek. */
  answered: (pending: IPendingSeek, applied: boolean) => void;
  /** Where the song is heard to be, in ms. */
  read: (now: number, playing: boolean) => number;
  /** Where the host has got to, in seconds, for handing the track back. */
  positionSeconds: () => number | undefined;
  durationMs: () => number;
  ended: () => boolean;
}

/** Past this, frames have stopped coming and the reading stops with them. */
const MAX_READ_AHEAD_MS = 500;
/** A step back smaller than this is a frame's jitter, never a seek. */
const JITTER_MS = 150;
/** More than any real output's delay; a figure past it is not one. */
const MAX_HEARD_DELAY_SECONDS = 0.5;

const heardDelaySeconds = (frame: IKaraokeHostFrame): number => {
  const device =
    frame.sampleRate > 0 ? frame.latencyFrames / frame.sampleRate : 0;
  const rack =
    frame.processingLatency && frame.processingLatency.rate > 0
      ? frame.processingLatency.frames / frame.processingLatency.rate
      : 0;
  const total = device + rack;
  return Number.isFinite(total)
    ? Math.min(MAX_HEARD_DELAY_SECONDS, Math.max(0, total))
    : 0;
};

export const createKaraokeHostClock = (): IKaraokeHostClock => {
  let positionSeconds: number | undefined;
  let at = 0;
  let state = DECK_READY;
  let duration = 0;
  let delaySeconds = 0;
  let pending: IPendingSeek | undefined;
  let lastReadMs: number | undefined;

  return {
    take: (frame, now) => {
      if (pending && seekSettled(pending, frame.deckPositionSeconds, true)) {
        pending = undefined;
        lastReadMs = undefined;
      }
      positionSeconds = frame.deckPositionSeconds;
      at = now;
      state = frame.deckState;
      duration = frame.deckDurationSeconds;
      delaySeconds = heardDelaySeconds(frame);
    },
    cued: (cuedSeconds, now) => {
      positionSeconds = cuedSeconds;
      at = now;
      state = DECK_READY;
      lastReadMs = undefined;
    },
    seek: (positionMs) => {
      pending = holdSeek(Math.max(0, positionMs));
      lastReadMs = undefined;
      return pending;
    },
    answered: (asked, applied) => {
      // A later seek has the playhead; this answer is about an earlier one.
      if (pending !== asked) {
        return;
      }
      pending = seekAnswered(asked, applied, positionSeconds ?? 0);
    },
    read: (now, playing) => {
      if (pending) {
        return pending.targetMs;
      }
      if (positionSeconds === undefined) {
        return 0;
      }
      const running = playing && state === DECK_READY;
      const ahead = running ? Math.min(MAX_READ_AHEAD_MS, now - at) : 0;
      const raw = positionSeconds * 1_000 + Math.max(0, ahead);
      const heard = Math.max(0, raw - (running ? delaySeconds * 1_000 : 0));
      const bounded = duration > 0 ? Math.min(duration * 1_000, heard) : heard;
      if (
        running &&
        lastReadMs !== undefined &&
        bounded < lastReadMs &&
        lastReadMs - bounded < JITTER_MS
      ) {
        return lastReadMs;
      }
      lastReadMs = running ? bounded : undefined;
      return bounded;
    },
    positionSeconds: () =>
      pending ? pending.targetMs / 1_000 : positionSeconds,
    durationMs: () => duration * 1_000,
    ended: () => state === DECK_ENDED,
  };
};
