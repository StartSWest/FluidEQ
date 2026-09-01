/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useEffect, useState } from 'react';

/**
 * The same grace period as a natural queue handoff.
 *
 * Five seconds is long enough for a destination player to publish and for a
 * quick tab check to feel continuous, but bounded: a paused Chromium guest,
 * karaoke workspace, library provider, or native DSP host cannot sit behind
 * another tab for the rest of the process lifetime.
 */
export const INACTIVE_PLAYER_DISPOSE_MS = 5_000;

interface IIdlePlayerMountOptions {
  isActive: boolean;
  hasLoadedSource: boolean;
  isPlaying: boolean;
  delayMs?: number;
}

/**
 * Keep the smallest hidden player shell for one short grace period.
 *
 * Active or audible players have no timer. An empty hidden player leaves
 * immediately. A loaded but silent one gets a bounded lease, after which the
 * component unmounts and its own cleanup disposes media elements, observers,
 * animation loops, web contents, and native resources. Returning to the tab
 * mounts it again and lets its persisted session restore normally.
 */
export const useIdlePlayerMount = ({
  isActive,
  hasLoadedSource,
  isPlaying,
  delayMs = INACTIVE_PLAYER_DISPOSE_MS,
}: IIdlePlayerMountOptions): boolean => {
  const [idleLeaseExpired, setIdleLeaseExpired] = useState(
    () => !isActive && !isPlaying && !hasLoadedSource,
  );

  useEffect(() => {
    if (isActive || isPlaying) {
      setIdleLeaseExpired(false);
      return undefined;
    }
    if (!hasLoadedSource) {
      setIdleLeaseExpired(true);
      return undefined;
    }

    setIdleLeaseExpired(false);
    const timer = window.setTimeout(() => setIdleLeaseExpired(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, hasLoadedSource, isActive, isPlaying]);

  return isActive || isPlaying || (hasLoadedSource && !idleLeaseExpired);
};

export default useIdlePlayerMount;
