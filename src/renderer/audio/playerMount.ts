/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

interface IPlayerMountFacts {
  /** On its tab, or drawn under the graph as its backdrop. */
  isActive: boolean;
  isPlaying: boolean;
  /** Between an ended item and the next one it has already confirmed. */
  isHandingOver: boolean;
  /** The last thing played — what the bar's play button resumes. */
  isLastOwner: boolean;
}

/**
 * Whether one of this app's players stays mounted.
 *
 * Where it is seen, while it makes sound or hands over to its next item, and
 * while it is the last thing played. Anything else leaves the moment it is out
 * of sight, and its own cleanup disposes the media elements, the web guest or
 * the native host it held; its tab mounts it again and its saved session
 * restores. So at most one silent player sits behind the other tabs, and it is
 * the one the bar is showing.
 *
 * NO LEASE. A loaded silent player used to be kept for five seconds after its
 * tab was left, on a timer, and the timer hid a hole: at launch a player that
 * has not been mounted yet has loaded nothing, so it counted as empty, was
 * never mounted off its tab, and the bar read "Nothing playing" over the queue
 * waiting in storage (Ivan, 2026-09-24). Being the last owner is the fact the
 * five seconds stood in for, and it holds for as long as it is true.
 */
const keepsPlayerMounted = ({
  isActive,
  isPlaying,
  isHandingOver,
  isLastOwner,
}: IPlayerMountFacts): boolean =>
  isActive || isPlaying || isHandingOver || isLastOwner;

export default keepsPlayerMounted;
