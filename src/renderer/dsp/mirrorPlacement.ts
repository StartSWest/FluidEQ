/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { INativeBackendController } from './nativeBackend';

/**
 * Where the rack runs for the track the mirror plays, prepared once and held
 * through a pause.
 *
 * PAUSE AND PLAY ARE THE TRANSPORT AND NOTHING ELSE (Ivan, 2026-11-16: a
 * paused song resumed with a micro silence and the sound went back "un
 * momentito", the Karaoke's notes and seek bar with it). Every pause used to
 * release the placement and every play prepare it again, and both rewrote
 * the FluidEQ Engine's configuration: the source file went from the
 * Library's (`kind=library`, its level and noise floor, the rack the
 * engine's) to `kind=live` and back, the host went raw and back, and the
 * host's own rack switched on and off over the paused deck. The engine
 * rebuilt its graph at each of them, and the live normalizer a `live` source
 * gets carries a 2 ms look-ahead, so the delay moved by 96 frames at 48 kHz
 * every time: the graph crossed over (`graph.h`, `start_crossing`) right as
 * the music came back, and the host's latency moved the Karaoke's clock.
 *
 * So the placement is let go only when the player truly lets go of the
 * track: it is unloaded, the mirror is released (the host lent to the other
 * player, the track's engine torn down, the output changed), the host could
 * not take a track, a pause landed while a start was still being prepared,
 * or another player took the sound (`placementLetGo.ts`). A track cued while
 * paused keeps it too, as a track change while playing always has.
 */
export interface IMirrorPlacement {
  /** Prepared for this playback, and not let go since. */
  isHeld: () => boolean;
  /** Prepare it, as `preparePlayback` does, throwing when it throws. */
  prepare: () => Promise<void>;
  /** Give it back to the engine, after `stopped` when one is given. */
  letGo: (stopped?: Promise<unknown>) => Promise<void>;
  /** Another player took the sound: let go once the host is paused. */
  askToLetGo: () => void;
  /** The listener asked to play again: an earlier ask is over. */
  keep: () => void;
  /** Whether the let-go asked for is the step to take now. */
  letGoDue: (hostPlaying: boolean) => boolean;
}

export const createMirrorPlacement = (
  controller: INativeBackendController,
  onPlacement?: (held: boolean) => void,
): IMirrorPlacement => {
  let held = false;
  // Bumped by each prepare and each let-go, so a preparation overtaken by a
  // let-go (a pause while it waited on the engine) never claims the hold.
  let turn = 0;
  let letGoAsked = false;
  const hold = (next: boolean) => {
    if (next !== held) {
      held = next;
      onPlacement?.(next);
    }
  };
  return {
    isHeld: () => held,
    prepare: async () => {
      turn += 1;
      const asked = turn;
      await controller.preparePlayback?.();
      if (asked === turn) {
        hold(true);
      }
    },
    letGo: (stopped) => {
      turn += 1;
      letGoAsked = false;
      hold(false);
      return controller.finishPlayback?.(stopped) ?? Promise.resolve();
    },
    askToLetGo: () => {
      letGoAsked = true;
    },
    keep: () => {
      letGoAsked = false;
    },
    letGoDue: (hostPlaying) => {
      if (!letGoAsked || hostPlaying) {
        return false;
      }
      if (!held) {
        // Nothing is held: there is nothing to give back, and a release
        // would only rewrite the engine's files for no change.
        letGoAsked = false;
        return false;
      }
      return true;
    },
  };
};
