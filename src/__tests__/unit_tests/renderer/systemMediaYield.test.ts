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
 * Which of two players stops, when both could be making sound.
 *
 * One of them at a time, in both directions: start something here and the
 * machine's player is asked to pause, start something out there and ours
 * stops. The whole difficulty is the second or so in between — a pause has
 * been sent and the next reading of Windows has not caught up — where a rule
 * written on the state rather than on the change had the two take it in turns
 * to stop each other, with no clock involved either way.
 */

import { shouldYieldToSystem } from '../../../renderer/audio/useSystemMediaSource';

describe('yielding to the machine’s own player', () => {
  it('stops ours when any program out there starts', () => {
    expect(shouldYieldToSystem(true, 'library', true)).toBe(true);
  });

  it('leaves ours alone while nothing out there starts', () => {
    expect(shouldYieldToSystem(false, 'library', true)).toBe(false);
  });

  it('does not act on a reading where nothing started', () => {
    // Two readings this covers, and both used to stop the song that had just
    // started here: the watcher repeating a player's state when a position
    // moved, and the one reading after we asked that player to pause where
    // it has not stopped yet. Which programs are new is the whole question —
    // see the hook, where the two readings are played out.
    expect(shouldYieldToSystem(false, 'karaoke', true)).toBe(false);
  });

  it('has nothing to stop when this app is silent', () => {
    // The ordinary case: a browser starts and the bar simply shows it.
    expect(shouldYieldToSystem(true, undefined, true)).toBe(false);
  });

  it('leaves both alone when the setting is off', () => {
    // Two outputs, two rooms: a browser on one and the library on the other
    // is somebody's deliberate arrangement, and stopping either is this app
    // breaking a setup it cannot see. The switch lives on the card where the
    // second output is chosen — see `singlePlayer`.
    expect(shouldYieldToSystem(true, 'library', false)).toBe(false);
  });
});
