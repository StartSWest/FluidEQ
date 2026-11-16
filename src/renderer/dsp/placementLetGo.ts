/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { THostClient } from './hostLease';

/**
 * Something else took the sound: a player holding its paused track's rack
 * placement gives it back.
 *
 * A pause keeps where the rack runs exactly as it was while the track
 * played (`mirrorPlacement.ts`), so that a resume changes nothing but the
 * transport. That placement is the Library's or the Karaoke's for as long as
 * it holds the track, and has to go back to the FluidEQ Engine when another
 * player makes the sound instead — the Media tab, the other of the two, or a
 * program outside FluidEQ — or that player is heard through a rack placed
 * for a paused song: no rack at all while the host owned it, the paused
 * track's level and noise floor while the engine did.
 *
 * Asked by the player's own stopper (`registerPlayer`), which runs exactly
 * when another player claims the sound, and by the system media watcher
 * when a program out there starts while nothing of ours is playing. Each
 * mirror listens for its own client only: the Library's stopper runs when
 * the Karaoke claims, and must not undo the Karaoke's own hold.
 */
const listeners = new Map<THostClient, Set<() => void>>();

/** Ask `client`'s mirror to let go of its placement once it is paused. */
export const letGoOfDspPlacement = (client: THostClient): void => {
  listeners.get(client)?.forEach((listener) => listener());
};

/** Both players: a program outside FluidEQ has started. */
export const letGoOfEveryDspPlacement = (): void => {
  letGoOfDspPlacement('library');
  letGoOfDspPlacement('karaoke');
};

/** Heard by `client`'s mirror for as long as it lives. */
export const onDspPlacementLetGo = (
  client: THostClient,
  listener: () => void,
): (() => void) => {
  const set = listeners.get(client) ?? new Set<() => void>();
  set.add(listener);
  listeners.set(client, set);
  return () => {
    set.delete(listener);
  };
};
