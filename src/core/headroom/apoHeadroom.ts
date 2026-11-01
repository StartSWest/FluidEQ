/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISystemSound } from '../systemSound/systemSound';
import ApoHeadroomSupervisor from './apoHeadroomSupervisor';
import { createPeakFrames } from './peakFrames';

/** What decides whether Auto normalize on Equalizer APO is listening. */
export interface IApoHeadroomState {
  /**
   * Equalizer APO is the engine, Auto normalize and FluidEQ are on, and the
   * output being edited is the one Windows plays through. The FluidEQ Engine
   * keeps its own level inside Windows' audio and needs none of this.
   */
  enabled: boolean;
  /** The trim last settled on, which listening starts from. */
  trimDb: number;
  /**
   * A moving-spectrum estimate an older version left in the state: cleared
   * once, by writing the trim alone, before anything is measured.
   */
  hasLegacyProgramme: boolean;
}

export interface IApoHeadroom {
  /** Called with the state after anything that may have changed it. */
  follow(state: IApoHeadroomState): void;
  /** The chain the output plays through was edited: look again sooner. */
  edited(): void;
  /** Windows moved the default output: worth hearing again after a failure. */
  outputChanged(): void;
}

/**
 * Auto normalize on Equalizer APO, in the core.
 *
 * It listens to the output, after the EQ, and turns APO's preamp down before
 * the output clips — and back up when it has room. It ran in the window, on
 * a capture of Chromium's that the window kept open behind a minimise for it,
 * and so needed the whole window awake for a level nobody was looking at. The
 * core hears the output itself (`systemSound`), and only while this is on.
 *
 * A trim is written through main (`applyTrim`), and nothing is measured from
 * before it has landed: what was heard then was the old level. A helper that
 * fails leaves the static reserve in place, as the window's tap did, and is
 * tried again when the output changes — never on a timer.
 */
export const createApoHeadroom = ({
  systemSound,
  applyTrim,
}: {
  systemSound: ISystemSound;
  /** Write a trim; whether it was applied. */
  applyTrim: (trimDb: number) => Promise<boolean>;
}): IApoHeadroom => {
  let running:
    { supervisor: ApoHeadroomSupervisor; stop: () => void } | undefined;
  let gaveUp = false;
  let wanted: IApoHeadroomState | undefined;

  const start = (state: IApoHeadroomState) => {
    const supervisor = new ApoHeadroomSupervisor(
      state.trimDb,
      state.hasLegacyProgramme,
    );
    let isCurrent = true;
    // Nothing heard from before the last write counts: it was the old level.
    let acknowledgedFrame = 0;
    const frames = createPeakFrames((frame) => {
      if (!isCurrent || frame.startFrame < acknowledgedFrame) {
        return;
      }
      const trim = supervisor.observe(frame.peakDbfs, frame.durationMs);
      if (trim !== undefined) {
        write(trim);
      }
    });
    const write = (trim: number) => {
      applyTrim(trim)
        .then((applied) => {
          if (isCurrent && applied) {
            acknowledgedFrame = frames.heardFrames();
            supervisor.acknowledge(trim);
          }
          return undefined;
        })
        .catch(() => undefined);
    };
    const stop = systemSound.listen({
      ready: () => undefined,
      audio: (block) => frames.push(block),
      lost: () => {
        if (!isCurrent) {
          return;
        }
        isCurrent = false;
        running = undefined;
        gaveUp = true;
      },
    });
    if (!isCurrent) {
      return;
    }
    running = {
      supervisor,
      stop: () => {
        isCurrent = false;
        stop();
      },
    };
    if (state.hasLegacyProgramme) {
      write(state.trimDb);
    }
  };

  return {
    follow: (state) => {
      wanted = state;
      if (!state.enabled) {
        running?.stop();
        running = undefined;
        return;
      }
      if (!running && !gaveUp) {
        start(state);
      }
    },
    edited: () => running?.supervisor.notifyEdit(),
    outputChanged: () => {
      if (!gaveUp) {
        return;
      }
      gaveUp = false;
      if (wanted?.enabled) {
        start(wanted);
      }
    },
  };
};
