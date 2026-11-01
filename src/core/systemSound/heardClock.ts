/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISystemSound } from './systemSound';

/** One listening while time is wanted, and what it has heard so far. */
interface ICounting {
  stop: () => void;
  seconds: number;
}

/**
 * Time counted by the output's own sound: one step every `secondsPerStep`
 * heard, while it is wanted and only then. The output keeps sending blocks
 * through silence (the listening helper plays a hidden silent stream), so a
 * pause is counted as well as a song.
 *
 * For anything in the core that waits a while on music — the song memory's
 * settle and pause grace — with no timer: what says time has passed is the
 * sound having been heard for that long. Where nothing can hear the output
 * it says so (`isLost`), and asks nothing again until told the output
 * changed (`reset`).
 */
const createHeardClock = ({
  systemSound,
  secondsPerStep,
  onStep,
  onLost,
}: {
  systemSound: ISystemSound;
  secondsPerStep: number;
  onStep: () => void;
  onLost: () => void;
}) => {
  let running: ICounting | undefined;
  let isLost = false;

  const follow = (isWanted: boolean) => {
    if (!isWanted) {
      running?.stop();
      running = undefined;
      return;
    }
    if (running || isLost) {
      return;
    }
    const counting: ICounting = { stop: () => undefined, seconds: 0 };
    running = counting;
    counting.stop = systemSound.listen({
      ready: () => undefined,
      audio: (block) => {
        if (block.sampleRate <= 0) {
          return;
        }
        counting.seconds += block.frames / block.sampleRate;
        if (counting.seconds >= secondsPerStep) {
          counting.seconds = 0;
          onStep();
        }
      },
      lost: () => {
        if (running === counting) {
          running = undefined;
        }
        isLost = true;
        onLost();
      },
    });
  };

  return {
    /** Listen while `isWanted`, and stop when it is not. */
    follow,
    isLost: () => isLost,
    /** The output changed: it may be heard again. */
    reset: () => {
      isLost = false;
    },
  };
};

export default createHeardClock;
