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

/**
 * Which of this app's players stays mounted behind the other tabs.
 *
 * A player that leaves disposes of its media elements, its web guest or its
 * native host, and its tab brings it back from its saved session. So at most
 * one silent player sits out of sight, and it is the one the bar is showing.
 * No grace period decides any of it: what used to be a five-second lease is
 * now the fact it stood in for.
 */

import keepsPlayerMounted from '../../../renderer/audio/playerMount';

/** Out of sight, silent, not handing over, and not the last thing played. */
const idle = {
  isActive: false,
  isPlaying: false,
  isHandingOver: false,
  isLastOwner: false,
};

describe('keeping a player mounted', () => {
  it('keeps a player where it is seen', () => {
    expect(keepsPlayerMounted({ ...idle, isActive: true })).toBe(true);
  });

  it('lets a silent player go the moment it is out of sight, and brings it back on return', () => {
    // Nothing waits: out of sight and not the last thing played, it goes
    // now rather than after a lease, and its tab mounts it again.
    expect(keepsPlayerMounted(idle)).toBe(false);
    expect(keepsPlayerMounted({ ...idle, isActive: true })).toBe(true);
  });

  it('keeps a player out of sight for as long as it makes sound', () => {
    expect(keepsPlayerMounted({ ...idle, isPlaying: true })).toBe(true);
  });

  it('keeps a player through the handover to the next item it has already confirmed', () => {
    // Between an ended item and the next one there is no sound, and no
    // player may be torn down in that gap.
    expect(keepsPlayerMounted({ ...idle, isHandingOver: true })).toBe(true);
  });

  it('keeps the last thing played, even before it has loaded anything', () => {
    // At launch a player that has not been mounted yet has loaded nothing.
    // Read as empty it was never mounted off its tab, and the bar said
    // "Nothing playing" over the queue waiting in storage. Being the last
    // thing played is what keeps it, for as long as that is true.
    expect(keepsPlayerMounted({ ...idle, isLastOwner: true })).toBe(true);
  });
});
